import { useEffect, useState } from "react";
import { sound } from "../lib/sound";

export default function SoundControl() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => sound.subscribe(setEnabled), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest(".sound-toggle")) sound.play("tap");
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const toggle = async () => {
    const active = await sound.toggle();
    if (active !== false) sound.play("select");
  };

  return (
    <button className={`sound-toggle ${enabled ? "on" : ""}`} type="button" onClick={toggle} aria-pressed={enabled}>
      <span aria-hidden="true">{enabled ? "♫" : "×"}</span>
      {enabled ? "SUARA ON" : "SUARA OFF"}
    </button>
  );
}
