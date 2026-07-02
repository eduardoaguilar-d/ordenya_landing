export const SITE = {
  name: 'OrdenYa',
  legalName: 'OrdenYa',
  url: 'https://ordenya.app',
  description:
    'Recibe, organiza y administra pedidos de restaurante desde WhatsApp. Controla ventas, inventario y egresos en un solo lugar.',
  whatsappPhone: '524441234567',
  whatsappMessage: 'Hola, quiero información sobre OrdenYa para mi restaurante.',
  email: 'hola@ordenya.app',
  privacyEmail: 'privacidad@ordenya.app',
  legalLastUpdated: '2026-07-01',
  urls: {
    privacy: '/aviso-de-privacidad',
    terms: '/terminos-y-condiciones',
    dataDeletion: '/eliminacion-de-datos',
    cookies: '/politica-de-cookies',
  },
  mobile: {
    iosBundleId: 'app.ordenya.mobile',
    androidPackageName: 'app.ordenya.mobile',
    /** Reemplazar con tu Apple Team ID al publicar la app iOS */
    iosTeamId: 'TEAM_ID',
    /**
     * Reemplazar con la huella SHA-256 del certificado de firma de release de Android.
     * Obtener con: keytool -list -v -keystore release.keystore
     */
    androidSha256Fingerprints: ['SHA256_FINGERPRINT_PLACEHOLDER'],
  },
} as const;

export const LEGAL_URLS = {
  privacy: `${SITE.url}${SITE.urls.privacy}`,
  terms: `${SITE.url}${SITE.urls.terms}`,
  dataDeletion: `${SITE.url}${SITE.urls.dataDeletion}`,
  cookies: `${SITE.url}${SITE.urls.cookies}`,
} as const;
