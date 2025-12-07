import { MusicPlayer } from "@/components/MusicPlayer";
import { Helmet } from "react-helmet";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>NEXUS Audio System | Futuristic Music Player</title>
        <meta name="description" content="Experience music like never before with NEXUS - a futuristic audio player designed for those who seek something extraordinary and unique." />
      </Helmet>
      <MusicPlayer />
    </>
  );
};

export default Index;
