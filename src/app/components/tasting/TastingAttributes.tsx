import { tastingAtom } from "@/app/store/tasting";
import { useAtom } from "jotai";
import React from "react";

export const TastingAttributes: React.FC = () => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);

  const handleChange = (key: string, value: number) => {
    setTastingState((prev) => ({ ...prev, [key]: value }));
  };

  const attributes = ["friskhet", "fylde", "sødme", "snærp", "karakter"];

  return (
    <div className="grid">
      {attributes.map((attr) => (
        <div className="l12 s12" key={attr}>
          <div className="center middle-align row">{attr}</div>
          <div className="row">
            <p>1</p>
            <label className="max">
              <input
                type="range"
                min="1"
                max={attr === "karakter" ? 6 : 12}
                value={tastingState[attr]}
                onChange={(e) => handleChange(attr, parseInt(e.target.value))}
              />
            </label>
            <p>12</p>
          </div>
          <div className="center middle-align row">{tastingState[attr]}</div>
          <hr />
        </div>
      ))}
    </div>
  );
};
