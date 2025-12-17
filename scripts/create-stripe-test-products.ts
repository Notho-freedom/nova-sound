#!/usr/bin/env tsx
/**
 * Script pour créer des produits et prix de test Stripe
 * 
 * Ce script crée :
 * - Un produit "NEXUS Pro Monthly"
 * - Un produit "NEXUS Pro Yearly"
 * - Les prix associés (mensuel et annuel)
 * 
 * Usage:
 *   npx tsx scripts/create-stripe-test-products.ts
 *   ou
 *   npx tsx scripts/create-stripe-test-products.ts --api-key sk_test_...
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Get Stripe secret key from command line or environment
const STRIPE_SECRET_KEY = process.argv[2] || process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquante');
  console.error('\nUsage:');
  console.error('  npx tsx scripts/create-stripe-test-products.ts');
  console.error('  ou');
  console.error('  npx tsx scripts/create-stripe-test-products.ts --api-key sk_test_...');
  console.error('\nAssurez-vous que STRIPE_SECRET_KEY est définie dans .env.local');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY.trim(), {
  apiVersion: '2025-11-17.clover',
});

interface ProductInfo {
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
}

async function createTestProducts(): Promise<ProductInfo> {
  console.log('🚀 Création des produits et prix de test Stripe...\n');

  try {
    // 1. Créer le produit mensuel
    console.log('📦 Création du produit "NEXUS Pro Monthly"...');
    const monthlyProduct = await stripe.products.create({
      name: 'NEXUS Pro Monthly',
      description: 'Abonnement mensuel NEXUS Pro - Accès complet à toutes les fonctionnalités premium',
      metadata: {
        type: 'subscription',
        billing_period: 'monthly',
        created_by: 'test-script',
      },
    });
    console.log(`✅ Produit créé: ${monthlyProduct.id} (${monthlyProduct.name})\n`);

    // 2. Créer le prix mensuel
    console.log('💰 Création du prix mensuel...');
    const monthlyPrice = await stripe.prices.create({
      product: monthlyProduct.id,
      unit_amount: 999, // 9.99 EUR en centimes
      currency: 'eur',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan: 'pro',
        billing_period: 'monthly',
      },
    });
    console.log(`✅ Prix mensuel créé: ${monthlyPrice.id} (9.99 EUR/mois)\n`);

    // 3. Créer le produit annuel
    console.log('📦 Création du produit "NEXUS Pro Yearly"...');
    const yearlyProduct = await stripe.products.create({
      name: 'NEXUS Pro Yearly',
      description: 'Abonnement annuel NEXUS Pro - Accès complet à toutes les fonctionnalités premium (économisez 2 mois)',
      metadata: {
        type: 'subscription',
        billing_period: 'yearly',
        created_by: 'test-script',
      },
    });
    console.log(`✅ Produit créé: ${yearlyProduct.id} (${yearlyProduct.name})\n`);

    // 4. Créer le prix annuel (avec réduction de ~17% = économie de 2 mois)
    console.log('💰 Création du prix annuel...');
    const yearlyPrice = await stripe.prices.create({
      product: yearlyProduct.id,
      unit_amount: 9990, // 99.90 EUR en centimes (au lieu de 119.88 EUR pour 12 mois)
      currency: 'eur',
      recurring: {
        interval: 'year',
      },
      metadata: {
        plan: 'pro',
        billing_period: 'yearly',
      },
    });
    console.log(`✅ Prix annuel créé: ${yearlyPrice.id} (99.90 EUR/an)\n`);

    return {
      productId: monthlyProduct.id, // On retourne le produit mensuel comme référence principale
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
    };
  } catch (error: any) {
    console.error('❌ Erreur lors de la création des produits:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('\n💡 Vérifiez que votre clé API Stripe est correcte.');
      console.error('   Pour les tests, utilisez une clé commençant par sk_test_');
    }
    throw error;
  }
}

async function updateEnvFile(priceIds: ProductInfo): Promise<void> {
  const envFiles = ['.env.local', '.env'];
  
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    
    if (!fs.existsSync(envPath)) {
      console.log(`⚠️  Fichier ${envFile} non trouvé, création...`);
      fs.writeFileSync(envPath, '');
    }

    let content = fs.readFileSync(envPath, 'utf-8');
    let updated = false;

    // Update or add STRIPE_PRICE_PRO_MONTHLY
    if (content.includes('STRIPE_PRICE_PRO_MONTHLY=')) {
      content = content.replace(
        /STRIPE_PRICE_PRO_MONTHLY=.*/g,
        `STRIPE_PRICE_PRO_MONTHLY=${priceIds.monthlyPriceId}`
      );
      updated = true;
    } else {
      // Add after STRIPE_SECRET_KEY if exists, otherwise at the end
      if (content.includes('STRIPE_SECRET_KEY=')) {
        content = content.replace(
          /(STRIPE_SECRET_KEY=.*)/,
          `$1\nSTRIPE_PRICE_PRO_MONTHLY=${priceIds.monthlyPriceId}`
        );
      } else {
        content += `\nSTRIPE_PRICE_PRO_MONTHLY=${priceIds.monthlyPriceId}`;
      }
      updated = true;
    }

    // Update or add STRIPE_PRICE_PRO_YEARLY
    if (content.includes('STRIPE_PRICE_PRO_YEARLY=')) {
      content = content.replace(
        /STRIPE_PRICE_PRO_YEARLY=.*/g,
        `STRIPE_PRICE_PRO_YEARLY=${priceIds.yearlyPriceId}`
      );
      updated = true;
    } else {
      // Add after STRIPE_PRICE_PRO_MONTHLY
      if (content.includes('STRIPE_PRICE_PRO_MONTHLY=')) {
        content = content.replace(
          /(STRIPE_PRICE_PRO_MONTHLY=.*)/,
          `$1\nSTRIPE_PRICE_PRO_YEARLY=${priceIds.yearlyPriceId}`
        );
      } else {
        content += `\nSTRIPE_PRICE_PRO_YEARLY=${priceIds.yearlyPriceId}`;
      }
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(envPath, content);
      console.log(`✅ Fichier ${envFile} mis à jour avec les nouveaux prix\n`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Création de produits et prix de test Stripe');
  console.log('='.repeat(60));
  console.log();

  // Check if using test key
  if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.warn('⚠️  ATTENTION: Vous utilisez une clé qui ne commence pas par sk_test_');
    console.warn('   Ce script est destiné à créer des produits de TEST uniquement.');
    console.warn('   Continuons quand même...\n');
  }

  try {
    // Create products and prices
    const priceIds = await createTestProducts();

    // Display results
    console.log('='.repeat(60));
    console.log('✅ Produits et prix créés avec succès!');
    console.log('='.repeat(60));
    console.log();
    console.log('📋 Informations des prix créés:');
    console.log();
    console.log(`   Mensuel:`);
    console.log(`   - Price ID: ${priceIds.monthlyPriceId}`);
    console.log(`   - Montant: 9.99 EUR/mois`);
    console.log();
    console.log(`   Annuel:`);
    console.log(`   - Price ID: ${priceIds.yearlyPriceId}`);
    console.log(`   - Montant: 99.90 EUR/an`);
    console.log();

    // Update .env files
    console.log('📝 Mise à jour des fichiers .env...');
    await updateEnvFile(priceIds);

    console.log('='.repeat(60));
    console.log('🎉 Configuration terminée!');
    console.log('='.repeat(60));
    console.log();
    console.log('📝 Prochaines étapes:');
    console.log('   1. Vérifiez que les variables suivantes sont dans .env.local:');
    console.log(`      STRIPE_PRICE_PRO_MONTHLY=${priceIds.monthlyPriceId}`);
    console.log(`      STRIPE_PRICE_PRO_YEARLY=${priceIds.yearlyPriceId}`);
    console.log('   2. Redémarrez votre serveur de développement');
    console.log('   3. Testez l\'upgrade vers Pro dans l\'application');
    console.log();
    console.log('💳 Pour tester un paiement:');
    console.log('   - Carte de test: 4242 4242 4242 4242');
    console.log('   - Date d\'expiration: n\'importe quelle date future');
    console.log('   - CVC: n\'importe quel 3 chiffres');
    console.log();
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
