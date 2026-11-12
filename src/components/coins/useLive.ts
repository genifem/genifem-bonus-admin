"use client";

import { useState } from "react";

/**
 * A value the page works estimates and previews out from: the API's, then whatever good value
 * the owner types, and the API's again if the page is drawn again with a new one.
 */
export function useLive<T>(value: T): [T, (next: T) => void] {
  const [live, setLive] = useState(value);
  const [seen, setSeen] = useState(value);
  if (!Object.is(value, seen)) {
    setSeen(value);
    setLive(value);
  }
  return [live, setLive];
}
