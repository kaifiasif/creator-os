import { secureHeaders } from 'hono/secure-headers';

/**
 * Browser-side defences for the API and the web app. The CSP forbids inline and third-party
 * scripts, so an XSS bug cannot load code that acts as the signed-in creator.
 * Inline styles stay allowed: Radix positions popovers and the chart sets colours with them.
 */
export const securityHeaders = () =>
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    referrerPolicy: 'strict-origin-when-cross-origin',
    xFrameOptions: 'DENY',
    // the recorder needs the microphone; nothing needs the camera or location
    permissionsPolicy: { microphone: ['self'], camera: [], geolocation: [] },
    crossOriginEmbedderPolicy: false,
  });
