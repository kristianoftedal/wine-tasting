# Rating tasting notes for accuracy

Thank you for rating. You are the measuring stick: the app's score is only as good as its agreement with experienced tasters, and this is how that agreement gets measured.

## What you get

`rating-sheet-2026-10.csv`, one row per note (236 rows): the event, the wine, the field (`lukt` = smell, `smak` = taste), Vinmonopolet's reference note, and what the taster wrote. Open it in Excel or Numbers (semicolon-separated, UTF-8). Rows are grouped by event and wine so you see every note on the same wine together.

Save your copy as `rater-<yourname>.csv` in this folder and leave the other columns untouched. Only the `key`, `rating`, `comment` and `attended` columns are read back.

## What to fill in

- **rating**: 0 to 4 (see below). Leave blank if you cannot judge.
- **comment**: optional. Especially useful when the taster used a word the reference does not, and you accepted it anyway ("brioche is bakverk", "tjære is fine on a Rhône"). Those comments become test cases.
- **attended**: `ja` if you were at that event and tasted that wine; otherwise blank. Rate the events you attended first.

## The scale

Judge only what the taster wrote, against the wine, not against the reference wording. A taster who writes "vanilje" on an oaked wine is right even if the note only says "fat". Length is not a virtue: one precise, correct descriptor beats four vague ones.

| Rating | Meaning |
| --- | --- |
| 4 | Every descriptor is supported by the wine; at least two are specific |
| 3 | Mostly supported, one minor miss or a vague term |
| 2 | Right style and families, few specific hits |
| 1 | Mostly unsupported, one or two lucky hits |
| 0 | Nothing supported, or contradicts the wine |

Structure words (fyldig, frisk, lang, balansert) describe body, acidity and length, which the app scores separately from numbers. Ignore them here unless they are all the taster wrote, in which case the note has no descriptors and rates 1 or 0.

## Three worked examples

All three are the same wine and the same reference note, from the Champagne tasting on 13 May 2026. Champagne Aubry Premier Cru Brut, smell:

> Litt utviklet og mineralsk, preg av gule epler, steinfrukt, kjeks, litt sitrus, røde bær og flint.

**"Rødt eple sitrus mineralsk"** → **4**. Three descriptors, all in the wine (apple, citrus, mineral), two of them specific. "Rødt" versus "gule" is a colour quibble, not a miss.

**"Fersken, plomme,"** → **2**. Stone fruit is in the wine, so "fersken" is a fair call. "Plomme" is not there and is not a typical champagne descriptor. Right family, one specific hit.

**"Mineral. Frukt. Nøtt. Krydder"** → **2**. Mineral is right; "frukt" is correct but says nothing; "nøtt" is defensible on a developed champagne (the note's "kjeks" points the same way); "krydder" is not supported. Four words, one specific hit.

And one from the taste side of the same wine, reference "God fylde og lengde, preg av syrlige epler, sitrus, litt jordbær, fersken, bakverk og mineraler.":

**"Brioche, Sitrus"** → **4**. Brioche is bakverk, the product of lees ageing. Two descriptors, both specific, both supported. A short note can score 4.

## What not to do

- Do not look up the app's score for the note. You are rating the note, not the score.
- Do not rate the reference note's quality. Some Vinmonopolet notes are thin; the taster is not responsible for that.
- Do not confer with the other raters before you are done. Disagreement is information.
