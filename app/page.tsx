import VideoConverter from "@/components/video-converter"

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3 font-sans">Video to Audio Converter</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Convert your video files to audio format (MP3) with automatic compression under 200MB
          </p>
        </div>
        <VideoConverter />
      </div>
    </main>
  )
}
