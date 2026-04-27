import { useEffect, useState } from "react";

const DEFAULT_DELAYED_MESSAGE =
  "Server sedang disiapkan, mohon tunggu beberapa detik...";

export default function LoadingMessage({
  children,
  className = "loading",
  delayMs = 3500,
  delayedMessage = DEFAULT_DELAYED_MESSAGE,
}) {
  const [showDelayedMessage, setShowDelayedMessage] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowDelayedMessage(true);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs]);

  return (
    <div className={className}>
      <div>{children}</div>
      {showDelayedMessage ? <div className="loading-detail">{delayedMessage}</div> : null}
    </div>
  );
}
