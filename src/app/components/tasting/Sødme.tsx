import React from 'react';

export const Sødme: React.FC = () => {
  return (
    <button className="chip round">
      <span>Sødme</span>
      <div className="tooltip bottom max large-space">
        <p>
          Sødme er smaken av sukker som er tilgjengelig i vinen. En tørr vin har sukkernivåer som er så lave at de ikke
          kan oppfattes på tungen. Om vinen har en veldig lett følelse av sødme på tungen omtales den som off - dry. Søt
          dekker viner hvor sukkeret definerer vinens stil. Dette er en bred kategori som dekker alle klassiske
          dessertviner og mange søte sterkviner.
        </p>
        <p>
          Medium søt og medium tørr brukes for viner med merkbart sukkernivå mellom off - dry og søt. Det kan hjelpe å
          tenke at dersom en vin smaker mer som en tørr vin enn en søt, men fremdeles har merkbart med sukker er den
          medium tørr og om den er mer som en søt vin, men ikke fult like søt er den medium søt.
        </p>
        <p>
          EU setter restriksjoner på bruk av de ulike sødmenivåene basert på gram sukker i vinen, men på smakeeksamen
          vil din evne til å smake korrekt være det som testes og ettersom det er mange modererende elementer i en vin
          vil vinens munnfølelse og ikke antall gram sukker legges til grunn for bedømmelse av sødme.{' '}
        </p>
        <p>
          Husk at det er viktig å ikke forveksle sødme med fruktighet da det er fort gjort å oppfatte en tørr vin med
          moden og sødmerik frukt som søtere enn en med grønn og syrlig frukt . I disse tilfeller er det lettest å
          bedømme sødmen på ettersmaken da tørre viner med moden frukt vil «stramme seg opp» litt på slutten og oppleves
          tørre på ettersmaken.
        </p>
      </div>
    </button>
  );
};
