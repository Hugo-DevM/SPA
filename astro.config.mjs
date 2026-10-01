// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.casavapor.mx',
  integrations: [
    icon({
      include: {
        // Phosphor. Solo los glifos que se usan de verdad entran al bundle.
        // Un icono que no esté en esta lista rompe el build con "Unable to
        // locate icon", aunque exista en el paquete.
        ph: [
          'arrow-right', 'arrow-up-right', 'arrow-left',
          'caret-left', 'caret-right', 'caret-down', 'caret-up',
          'check', 'check-circle', 'x', 'x-circle', 'warning-circle',
          'circle-notch', 'clock', 'calendar-blank', 'calendar-check',
          'map-pin', 'phone', 'whatsapp-logo', 'instagram-logo',
          'envelope-simple', 'lock-simple', 'sign-out', 'list',
          'drop', 'leaf', 'flower-lotus', 'hand-heart', 'sparkle',
          'copy', 'receipt', 'eye', 'hourglass-high', 'arrows-clockwise',
          'google-logo', 'microsoft-outlook-logo', 'apple-logo',
        ],
      },
    }),
  ],
});
