/**
 * Signature de l'APK avec la clé Orvia : si la variable ORVIA_KEYSTORE_FILE est définie (construction GitHub avec
 * les secrets ORVIA_KEYSTORE_B64 et ORVIA_KEYSTORE_PASSWORD), l'APK de production est signé avec cette clé ;
 * sinon, avec la clé de test d'Android, comme avant.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (System.getenv('ORVIA_KEYSTORE_FILE')) {
                storeFile file(System.getenv('ORVIA_KEYSTORE_FILE'))
                storePassword System.getenv('ORVIA_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ORVIA_KEY_ALIAS') ?: 'orvia'
                keyPassword System.getenv('ORVIA_KEYSTORE_PASSWORD')
                storeType 'pkcs12'
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes("System.getenv('ORVIA_KEYSTORE_FILE')")) return cfg;
    const debugBlock = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    if (!debugBlock.test(g)) throw new Error('withReleaseSigning : bloc signingConfigs introuvable.');
    g = g.replace(debugBlock, `$1${SIGNING}`);
    const releaseUse = /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUse.test(g)) throw new Error('withReleaseSigning : signature du build release introuvable.');
    g = g.replace(
      releaseUse,
      "$1signingConfig System.getenv('ORVIA_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = g;
    return cfg;
  });
};
