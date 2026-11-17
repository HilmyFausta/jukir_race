import { useState } from "react";
import TitleScreen from "../components/TitleScreen";
import SetupScreen from "../components/SetupScreen";
import GameScreen from "../components/GameScreen";
import SoundControl from "../components/SoundControl";

export default function Home() {
  const [screen, setScreen] = useState("title"); // title -> setup -> game
  const [config, setConfig] = useState(null);
  const [run, setRun] = useState(0);

  let content;
  if (screen === "title") {
    content = <TitleScreen onPlay={() => setScreen("setup")} />;
  } else if (screen === "setup") {
    content = (
      <SetupScreen
        initial={config}
        onBack={() => setScreen("title")}
        onStart={(c) => {
          setConfig(c);
          setRun((r) => r + 1);
          setScreen("game");
        }}
      />
    );
  } else {
    content = <GameScreen key={run} config={config} onExit={() => setScreen("setup")} />;
  }

  return (
    <>
      <SoundControl />
      {content}
    </>
  );
}
