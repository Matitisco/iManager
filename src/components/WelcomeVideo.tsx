import { useState } from "react";
import { Play } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export const WELCOME_VIDEO_SRC =
  import.meta.env.VITE_WELCOME_VIDEO_SRC?.trim() || "";
export const WELCOME_VIDEO_POSTER =
  import.meta.env.VITE_WELCOME_VIDEO_POSTER?.trim() || "/welcome-poster.svg";

/** No video element or source request exists until the user presses play. */
export function WelcomeVideo() {
  const { updateGettingStarted } = useAppContext();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="welcome-video">
      {playing && WELCOME_VIDEO_SRC ? (
        <video
          aria-label="Video de bienvenida"
          src={WELCOME_VIDEO_SRC}
          poster={WELCOME_VIDEO_POSTER}
          controls
          autoPlay
          playsInline
          preload="none"
          onError={() =>
            setError(
              "No pudimos reproducir el video. Podés seguir y volver desde Ayuda.",
            )
          }
          onEnded={() => {
            void updateGettingStarted({ videoWatched: true }).catch(() =>
              setError(
                "No se pudo guardar que viste el video. Podés continuar.",
              ),
            );
          }}
        />
      ) : (
        <button
          type="button"
          className="welcome-poster"
          aria-label="Reproducir video de bienvenida"
          onClick={() =>
            WELCOME_VIDEO_SRC
              ? setPlaying(true)
              : setError(
                  "El video va a estar disponible pronto. Podés seguir y verlo desde Ayuda.",
                )
          }
        >
          <img
            src={WELCOME_VIDEO_POSTER}
            alt="Bienvenido a iManager: stock, ventas, equipo e instalación"
            loading="lazy"
          />
          <span>
            <Play fill="currentColor" />
          </span>
        </button>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
