import React from 'react';

export const Aroma: React.FC = () => {
  return (
    <button className="chip round large">
      <h6>Aroma</h6>
      <div className="tooltip bottom max large-space">
        <b>Aromakarakteristikker</b>
        <p>
          Aromakarakterene kan deles inn i hovedkategoriene primær, sekundær og tertiære aromaer. Hver av disse kan
          igjen deles i hovedkategorier som sitrusfrukt eller blomster som igjen inneholder beskrivende ord som sitron,
          lime, grapefrukt eller hvite treblomster, roser, fioler. Ikke alle viner har både primær, sekundær og
          tertiæraromaer.
        </p>
        <p>
          Primæraromaer: Disse aromaene kommer fra druen eller blir skapt i løpet av gjæringen. Veldig enkle og
          fruktdrevne viner har kun primæraromaer, begrenset antall av dem og gjerne kun fra en eller to
          hovedkategorier.
        </p>
        <p>
          Sekundæraromaer: Disse aromaene kommer fra vinmakerteknikker etter gjæringen. De vanligste sekundæraromaene
          kommer fra eik, som vanilje, toast eller røyk , men de inkluderer også f.eks. fløte og smør aromaer fra
          malolaktisk omdanning.
        </p>
        <p>
          Tertiæraromaer: Aromaer som kommer fra lagringen etter vinmakingen er ferdig , hovedsakelig fra flaskelagring.
          Disse aromaene kan f.eks. være petroleum, honning og sopp. Lagringen endrer også fruktaromaene og med
          flaskelagring vil ofte primærfrukten endres i retning tørket frukt. Når man bedømmer vinens aromaer er det
          viktig å være spesifikk og detaljert og inkludere alle aromakarakterer man synes er relevant.
        </p>
      </div>
    </button>
  );
};
