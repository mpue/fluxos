# FluxOS Login System

## Test-Benutzer erstellen

Um den Login zu testen, müssen Sie zuerst einen Benutzer in der Datenbank erstellen.

### Option 1: Seed-Script (Empfohlen)

```bash
cd server
npm run seed
```

Dies erstellt automatisch:
- **Benutzername**: admin
- **Passwort**: admin123
- **Email**: admin@fluxos.local

### Option 2: Manuell über API

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@fluxos.local",
    "password": "admin123"
  }'
```

## Login-Features

✅ Professioneller Login-Screen mit:
- Animierter Gradient-Hintergrund
- Aktuelle Uhrzeit und Datum
- Moderne UI mit Blur-Effekten
- Fehlerbehandlung mit Animationen
- Loading-Spinner während des Logins

✅ Auth-System:
- Passwort-Hashing mit bcrypt
- Session-Verwaltung über localStorage
- Login/Logout-Funktionalität
- Geschützte Routen

✅ Integration:
- Benutzername im Startmenü
- Abmelden-Button im Startmenü
- Browser-Zurück-Button blockiert nach Login

## API-Endpunkte

### POST /api/users/login
Login für Benutzer

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (Erfolg):**
```json
{
  "id": "user-id",
  "username": "admin",
  "email": "admin@fluxos.local",
  "createdAt": "2026-02-01T..."
}
```

**Response (Fehler):**
```json
{
  "error": "Invalid username or password"
}
```

## Entwicklung

### Server starten
```bash
cd server
npm run dev
```

### Client starten
```bash
cd client
npm run dev
```

### Mit Docker
```bash
docker-compose up -d --build
```

## Sicherheitshinweise

⚠️ Dies ist eine Demo-Implementierung. Für Produktion sollten Sie:
- JWT-Tokens statt localStorage verwenden
- HTTPS für API-Kommunikation
- Session-Timeouts implementieren
- Rate-Limiting für Login-Versuche
- 2-Faktor-Authentifizierung hinzufügen
