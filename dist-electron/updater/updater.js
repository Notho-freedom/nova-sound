import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
// @ts-expect-error - unzipper n'a pas de types TypeScript officiels
import unzipper from 'unzipper';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Chemin vers le build local
const localUIPath = path.join(__dirname, '../../local-ui');
const versionFile = path.join(localUIPath, 'version.json');
const backupUIPath = path.join(__dirname, '../../local-ui-backup');
// Fonction pour obtenir l'URL Vercel (peut être surchargée par variable d'environnement)
const getVercelUrl = () => {
    // Priorité: UPDATE_BASE_URL > NEXT_PUBLIC_VERCEL_URL > valeur par défaut
    if (process.env.UPDATE_BASE_URL) {
        return process.env.UPDATE_BASE_URL;
    }
    // En production Electron, on peut aussi lire depuis un fichier de config
    // ou utiliser une valeur hardcodée pour votre app Vercel
    return process.env.VERCEL_URL || 'https://nexus-player.vercel.app';
};
const VERCEL_BASE_URL = getVercelUrl();
const REMOTE_VERSION_URL = `${VERCEL_BASE_URL}/api/update/version`;
const REMOTE_BUILD_URL = `${VERCEL_BASE_URL}/api/update/build`;
export async function getLocalVersion() {
    try {
        if (!fs.existsSync(versionFile)) {
            console.log('Local version.json not found.');
            return null;
        }
        const data = fs.readFileSync(versionFile, 'utf-8');
        return JSON.parse(data).version;
    }
    catch (error) {
        console.error('Error reading local version file:', error);
        return null;
    }
}
async function createBackup() {
    if (fs.existsSync(localUIPath)) {
        console.log('Creating backup of current local UI...');
        fs.rmSync(backupUIPath, { recursive: true, force: true });
        await fs.promises.cp(localUIPath, backupUIPath, { recursive: true });
        console.log('Backup created successfully.');
    }
}
async function restoreBackup() {
    if (fs.existsSync(backupUIPath)) {
        console.log('Restoring local UI from backup...');
        fs.rmSync(localUIPath, { recursive: true, force: true });
        await fs.promises.cp(backupUIPath, localUIPath, { recursive: true });
        console.log('Local UI restored from backup.');
    }
    else {
        console.warn('No backup found to restore.');
    }
}
export async function downloadAndReplaceBuild(remoteUrl) {
    const tmpZip = path.join(__dirname, '../../tmp-build.zip'); // Temp file outside local-ui
    try {
        await createBackup(); // Create backup before attempting update
        console.log('Downloading new build from:', remoteUrl);
        const response = await axios({ url: remoteUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(tmpZip);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', (err) => {
                console.error('Error writing temporary zip file:', err);
                reject(err);
            });
        });
        console.log('Download complete. Extracting...');
        // Clear existing local-ui content
        fs.rmSync(localUIPath, { recursive: true, force: true });
        fs.mkdirSync(localUIPath, { recursive: true });
        // Extract the new build
        await new Promise((resolve, reject) => {
            fs.createReadStream(tmpZip)
                .pipe(unzipper.Extract({ path: localUIPath }))
                .on('close', () => resolve())
                .on('error', (err) => {
                console.error('Error extracting zip file:', err);
                reject(err);
            });
        });
        console.log('Build extracted successfully.');
        fs.unlinkSync(tmpZip); // Clean up temp zip
        console.log('Temporary zip file removed.');
        // Remove backup after successful update
        fs.rmSync(backupUIPath, { recursive: true, force: true });
        console.log('Backup removed after successful update.');
    }
    catch (err) {
        console.error('Failed to download or replace build:', err);
        await restoreBackup(); // Restore from backup on error
        throw err; // Re-throw to indicate failure
    }
    finally {
        if (fs.existsSync(tmpZip)) {
            fs.unlinkSync(tmpZip); // Ensure temp zip is always cleaned
        }
    }
}
/**
 * Vérifie et télécharge les mises à jour si nécessaire
 * @param onUpdateAvailable - Callback appelé quand une mise à jour est disponible (avec les infos de version)
 */
export async function checkForUpdates(onUpdateAvailable) {
    try {
        console.log('Vérification des mises à jour...');
        // Récupérer la version distante
        const remoteResponse = await axios.get(REMOTE_VERSION_URL, {
            timeout: 10000, // 10 secondes timeout
        });
        const remoteVersionInfo = remoteResponse.data;
        const remoteVersion = remoteVersionInfo.version;
        // Récupérer la version locale
        const localVersion = await getLocalVersion();
        console.log(`Version locale: ${localVersion || 'non trouvée'}`);
        console.log(`Version distante: ${remoteVersion}`);
        // Comparer les versions (ou buildNumber si disponible)
        let needsUpdate = !localVersion || remoteVersion !== localVersion;
        // Vérifier aussi le buildNumber si disponible
        if (!needsUpdate && remoteVersionInfo.buildNumber) {
            try {
                if (fs.existsSync(versionFile)) {
                    const localVersionInfo = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
                    needsUpdate = localVersionInfo.buildNumber !== remoteVersionInfo.buildNumber;
                }
            }
            catch (error) {
                // Ignore errors reading local version file
            }
        }
        if (needsUpdate) {
            console.log(`Nouvelle version détectée: ${remoteVersion}`);
            await downloadAndReplaceBuild(REMOTE_BUILD_URL);
            // Notifier qu'une mise à jour a été effectuée
            if (onUpdateAvailable) {
                onUpdateAvailable(remoteVersionInfo);
            }
            return { updated: true, versionInfo: remoteVersionInfo };
        }
        else {
            console.log('Build local à jour');
            return { updated: false };
        }
    }
    catch (error) {
        // En cas d'erreur (pas de connexion, serveur indisponible, etc.)
        // On continue avec le build local (offline-first)
        console.log('Impossible de vérifier les mises à jour, utilisation du build local');
        if (error instanceof Error) {
            console.error('Détails:', error.message);
        }
        return { updated: false };
    }
}
/**
 * Initialise le système de mise à jour (appelé au démarrage)
 * @param onUpdateAvailable - Callback appelé quand une mise à jour est disponible
 */
export async function initUpdater(onUpdateAvailable) {
    // S'assurer que le dossier local-ui existe
    if (!fs.existsSync(localUIPath)) {
        fs.mkdirSync(localUIPath, { recursive: true });
        console.log('Dossier local-ui créé');
    }
    // Vérifier les mises à jour en arrière-plan (non-bloquant)
    checkForUpdates(onUpdateAvailable).catch((error) => {
        console.error('Erreur lors de la vérification des mises à jour:', error);
    });
}
//# sourceMappingURL=updater.js.map