export default function TitleScreen({ onPlay }) {
  return (
    <div className="title-screen">
      <div className="title-bg" />
      <div className="title-dither" />
      <div className="title-ground" />

      <img className="title-logo" src="/assets/logo.png" alt="Jukir Race" />

      <div className="title-stage">
        <div className="mascot left">
          <img src="/assets/char/indoapril.gif" alt="Indoapril" />
          <div className="nameplate blue">INDOAPRIL</div>
        </div>
        <div className="vs">VS</div>
        <div className="mascot right">
          <img src="/assets/char/betamart.gif" alt="Betamart" />
          <div className="nameplate red">BETAMART</div>
        </div>
      </div>

      <button className="px-btn play-btn" onClick={onPlay}>
        PLAY
      </button>
      <p className="title-foot">KKA &middot; Adversarial Search &middot; Minimax + Alpha-Beta</p>
    </div>
  );
}
