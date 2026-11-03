import { useState } from "react";
import TitleScreen from "../components/TitleScreen";
import SetupScreen from "../components/SetupScreen";
import GameScreen from "../components/GameScreen";

export default function Home() {
  const [screen, setScreen] = useState("title"); // title -> setup -> game
  const [config, setConfig] = useState(null);
  const [run, setRun] = useState(0);

  if (screen === "title") return <TitleScreen onPlay={() => setScreen("setup")} />;

  if (screen === "setup")
    return (
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

  return <GameScreen key={run} config={config} onExit={() => setScreen("setup")} />;
}
