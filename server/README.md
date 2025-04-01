# YouTube Video İndirme Server'ı

Bu server, YouTube videolarını indirmek için kullanılan bir API servisidir.

## Özellikler

- Video format bilgilerini getirme
- Seçilen formatta video indirme
- CORS desteği

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Video Bilgisi Alma
```
POST /api/video-info
Content-Type: application/json

{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### Video İndirme
```
POST /api/download
Content-Type: application/json

{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "itag": "FORMAT_ITAG"
}
```

## Örnek Kullanım

1. Video bilgilerini almak için:
```bash
curl -X POST http://localhost:3000/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

2. Video indirmek için:
```bash
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID", "itag": "FORMAT_ITAG"}' \
  -o video.mp4
``` 