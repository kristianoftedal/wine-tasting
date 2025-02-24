"use client";

import { addTasting } from "@/actions/tasting";
import { useAtom } from "jotai";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { tastingAtom } from "../../store/tasting";
import { Color } from "./color";
import { FlavorSelection } from "./FlavorSelection";
import { TastingProps } from "./props";
import { Summary } from "./Summary";
import { TastingAttributes } from "./TastingAttributes";

export const TastingWizard: React.FC<TastingProps> = ({ inputWine }) => {
  const [wine, setWine] = useAtom(inputWine);
  const [tasting] = useAtom(tastingAtom);
  setWine(inputWine);
  const router = useRouter();
  const { status, data } = useSession();

  const [index, setIndex] = useState<number>(0);
  const steps = ["Se", "Aroma", "Smak", "Egenskaper", "Oppsummering"];

  const onSave = async () => {
    const userId = data?.user?.id;
    const productId = wine.code;
    await addTasting({ ...tasting, userId, productId });
  };

  return (
    <>
      <header className="primary-container">
        <nav>
          <button
            className="circle transparent"
            onClick={() => router.push("/")}
          >
            <i>arrow_back</i>
          </button>
          <h5 className="max">{wine.name}</h5>
        </nav>
      </header>
      <main className="responsive" key={"unique"}>
        {index === 0 && <Color />}
        {index === 1 && <FlavorSelection type="lukt" />}
        {index === 2 && <FlavorSelection type="smak" />}
        {index === 3 && <TastingAttributes />}
        {index === 4 && <Summary wine={wine} />}
      </main>
      <footer>
        <nav className="padding">
          {index > 0 && (
            <button
              className="circle transparent"
              onClick={() => setIndex(index > 0 ? index - 1 : 0)}
            >
              <i>arrow_back</i>
              Forrige
            </button>
          )}
          <h6 className="max center-align">{steps[index]?.title}</h6>
          {index <= steps.length && (
            <button
              className="circle transparent"
              onClick={() =>
                setIndex(index + 1 <= steps.length ? index + 1 : index)
              }
            >
              {steps[index + 1]?.title}
              <i>arrow_forward</i>
            </button>
          )}
          {index === 4 && status === "authenticated" && (
            <button
              class="circle extra fill"
              onClick={async () => await onSave()}
            >
              <i>add</i>
            </button>
          )}
        </nav>
      </footer>
    </>
  );
};
