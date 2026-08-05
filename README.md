# CDH Maker — Portafolio de servicios

Sitio web del portafolio de servicios de **CDH Maker**: desarrollo web y software, fabricación digital (impresión 3D, corte láser, CNC), electrónica e IoT, y diseño/consultoría técnica.

**Autor:** Ing. Henry Taborda — CDH Maker (Medellín, Colombia) · cdhmaker@gmail.com

> 📘 **Documentación completa de la plataforma:** ver [MANUAL-TECNICO.md](MANUAL-TECNICO.md)
> (arquitectura, autenticación, CRM, i18n, chatbot, seguridad, despliegue y mantenimiento).

## Seguridad y clientes

- **Anti-inspección**: en producción se bloquean clic derecho, atajos de DevTools y se ofusca el contenido si se detecta inspección.
- **Cuenta obligatoria** para ver **servicios** y **contacto**. Los visitantes pueden explorar el portafolio, pero no ven número ni correo.
- **Base de clientes**: cada registro guarda nombre, email, teléfono, empresa e interés.
  - Notificación por correo a CDH Maker (FormSubmit).
  - CRM local en el navegador + panel `admin-clientes.html`.
  - Firebase Auth + Firestore listos (cuando los actives en la consola).

### Activar Firebase Auth + Firestore (recomendado, multi-dispositivo)

1. Abre [Firebase Console](https://console.firebase.google.com/project/cdh-maker-portafolio).
2. **Authentication** → Sign-in method → habilita **Email/Password**.
3. **Firestore Database** → Create database → reglas en producción (luego despliega las de este repo).
4. Despliega reglas:

```bash
firebase deploy --only firestore:rules,hosting
```

### Panel de clientes

- URL: `/admin-clientes` — protegido por clave (en el código solo vive su hash SHA-256; ver MANUAL-TECNICO.md §6 para cambiarla).
- Exporta CSV de los clientes registrados en ese navegador.
- Cada alta también llega por correo.

## Experiencia del sitio

- **Fondo animado**: canvas de seis capas (malla en perspectiva, red neuronal con paquetes
  de datos, partículas 3D y HUD holográfico). Se adapta al tema y respeta *reducir movimiento*.
- **Asesor "Maker" (100% texto con memoria avanzada)**: recuerda el contexto de la conversación (servicio elegido, productos de interés, detalles técnicos y alcance) durante toda la sesión. Construye enlaces de cotización personalizados para WhatsApp con todo el requerimiento acumulado.
- **Carga liviana**: el SDK de Firebase (~300 KB) solo se descarga si el visitante abre el
  área de clientes; imágenes en WebP y el video del anuncio se pide recién al desplegarlo.
- **10 idiomas sin peso muerto**: cada diccionario es un archivo aparte y solo se baja el
  que se usa. Quien entra en español no descarga ninguno (103 KB → 8,8 KB).

## Estructura

```
public/               # Sitio estático (HTML, CSS, JS)
  auth.js             # Registro / login / CRM (Firebase bajo demanda)
  chatbot.js          # Asesor "Maker" (motor conversacional 100% texto con memoria)
  chatbot-kb.js       # Base de conocimiento de Maker (carga bajo demanda)
  metaverse.js        # Fondo animado
  i18n.js             # Motor de idiomas
  i18n/               # Un diccionario por idioma (carga bajo demanda)
  security.js         # Protección anti-inspección
  admin-clientes.html # Panel privado de clientes
  robots.txt          # Rastreo (excluye perfil y admin)
  sitemap.xml         # Mapa del sitio
_originales-media/    # Copias sin comprimir del material (no se publican)
firebase.json         # Hosting + cabeceras de seguridad
firestore.rules       # Reglas de la base de clientes
```

## Desarrollo local

```bash
firebase serve
```

En `localhost` la capa anti-inspección se desactiva para que puedas trabajar con DevTools.

## Despliegue

```bash
firebase deploy --only hosting
```

---
Hecho con 💜 en Colombia.
