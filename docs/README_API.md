# Nexus Audio Player - API Documentation

## Overview

The Nexus Audio Player API provides endpoints for file storage, subscription management, and cloud synchronization.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.nexus-audio.com/api`

## Authentication

All protected endpoints require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token can be either:
- **Firebase ID token** (recommended)
- **Google OAuth access token**

## OpenAPI Specification

Full API documentation is available in OpenAPI 3.1 format:

- **OpenAPI Spec**: [docs/openapi.yaml](./docs/openapi.yaml)
- **View Online**: Use [Swagger Editor](https://editor.swagger.io/) or [Swagger UI](https://swagger.io/tools/swagger-ui/) to view the spec

## Quick Start

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 2. Upload a File

```bash
curl -X POST http://localhost:3000/api/storage/upload \
  -H "Authorization: Bearer <your-token>" \
  -F "file=@song.mp3"
```

Response:
```json
{
  "id": "1234567890-123456789",
  "url": "https://cdn.example.com/nexus/user123/file.mp3",
  "size": 5242880,
  "filename": "song.mp3",
  "provider": "bunny"
}
```

### 3. Get Subscription Status

```bash
curl http://localhost:3000/api/stripe/subscription-status \
  -H "Authorization: Bearer <your-token>"
```

Response:
```json
{
  "isPro": true,
  "status": "active",
  "currentPeriodEnd": "2024-02-01T00:00:00Z",
  "plan": "monthly"
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Error Codes

- `VALIDATION_ERROR` - Invalid input or validation failed
- `AUTHENTICATION_ERROR` - User not authenticated
- `AUTHORIZATION_ERROR` - User not authorized
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error
- `EXTERNAL_SERVICE_ERROR` - External service (Stripe, Bunny) error

## Rate Limiting

API requests are rate-limited. Contact support if you need higher limits.

## File Upload Limits

- **Free users**: 100MB per file
- **Pro users**: 500MB per file

## Supported File Types

- **Audio**: MP3, WAV, FLAC, AAC, OGG
- **Video**: MP4, AVI, MKV, WebM
- **Images**: JPEG, PNG, GIF, WebP

## Examples

### JavaScript/TypeScript

```typescript
// Upload file
const formData = new FormData();
formData.append('file', file);

const response = await fetch('http://localhost:3000/api/storage/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

files = {
    'file': open('song.mp3', 'rb')
}

response = requests.post(
    'http://localhost:3000/api/storage/upload',
    headers=headers,
    files=files
)

result = response.json()
```

## Testing

Use the provided test scripts:

```bash
# Test all API routes
npm run test:api

# Validate environment variables
npm run validate:env
```

## Support

For questions or issues:
- Email: support@nexus-audio.com
- Documentation: [docs/openapi.yaml](./docs/openapi.yaml)
