/**
 * Utilitaire pour tester la clé API YouTube
 */

export interface YouTubeApiTestResult {
  success: boolean;
  message: string;
  quotaUsed?: number;
}

/**
 * Teste si une clé API YouTube est valide
 */
export async function testYouTubeApiKey(apiKey: string): Promise<YouTubeApiTestResult> {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      message: "Clé API vide",
    };
  }

  try {
    // Test simple : rechercher "test" pour vérifier que la clé fonctionne
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=test&` +
      `type=video&` +
      `maxResults=1&` +
      `key=${apiKey.trim()}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 400) {
        return {
          success: false,
          message: "Clé API invalide ou format incorrect",
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          message: "Clé API invalide ou quota dépassé. Vérifiez dans Google Cloud Console.",
        };
      }

      return {
        success: false,
        message: `Erreur API: ${response.status} - ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return {
        success: true,
        message: "Clé API valide et fonctionnelle !",
        quotaUsed: 1, // Une requête de test
      };
    }

    return {
      success: true,
      message: "Clé API valide (aucun résultat de test)",
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erreur de connexion: ${error.message}`,
    };
  }
}

/**
 * Vérifie si l'API YouTube Data v3 est activée pour cette clé
 */
export async function checkYouTubeApiEnabled(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=test&` +
      `type=video&` +
      `maxResults=1&` +
      `key=${apiKey.trim()}`
    );

    return response.ok;
  } catch {
    return false;
  }
}
