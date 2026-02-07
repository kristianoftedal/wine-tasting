# Manual Validation Checklist

Generated: 2026-02-07

## Pre-requisites

- [ ] App running locally with `npm run dev`
- [ ] Profile set to `inverted` in `.env.local`: `NEXT_PUBLIC_WEIGHT_PROFILE=inverted`
- [ ] Database connected and wines loaded

## Test Cases

### TC-01: Specific Berry Terms

1. Navigate to wine tasting comparison
2. For any red wine, enter in smell field: "solbaer og kirsebær"
3. Enter in taste field: "kirsebær med bringebær"
4. Compare against the wine's actual notes
5. **Expected:** High match score (> 70%) if wine has similar berry notes
6. **Result:** [ ] Pass [ ] Fail
7. **Notes:** _______________

### TC-02: Generic Structure Terms

1. For same wine, enter in smell field: "frisk og balansert"
2. Enter in taste field: "god struktur"
3. Compare against wine
4. **Expected:** Lower score than TC-01 if wine has specific notes
5. **Result:** [ ] Pass [ ] Fail
6. **Notes:** _______________

### TC-03: Oak/Barrel Terms

1. Select wine with oak aging
2. Enter smell: "eik og vanilje fatpreg"
3. Enter taste: "fatlagret med toast"
4. **Expected:** High score if wine is oak-aged
5. **Result:** [ ] Pass [ ] Fail
6. **Notes:** _______________

### TC-04: Spice vs Acidity

1. Select spicy wine (e.g., Syrah, Zinfandel)
2. Enter smell: "pepper og nellik"
3. Compare to entering: "frisk syre"
4. **Expected:** Pepper notes should score higher if wine is spicy
5. **Result:** [ ] Pass [ ] Fail
6. **Notes:** _______________

### TC-05: Profile Switching

1. Set `NEXT_PUBLIC_WEIGHT_PROFILE=data-driven` in .env.local
2. Restart dev server
3. Repeat TC-01 and TC-02
4. **Expected:** Score difference should be smaller or reversed (generic terms score higher in data-driven)
5. **Result:** [ ] Pass [ ] Fail
6. **Notes:** _______________

## Summary

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| TC-01 | [ ] | [ ] | |
| TC-02 | [ ] | [ ] | |
| TC-03 | [ ] | [ ] | |
| TC-04 | [ ] | [ ] | |
| TC-05 | [ ] | [ ] | |

## Sign-off

- [ ] All critical tests pass
- [ ] Inverted profile rewards specific tasting notes
- [ ] Profile switching works as expected

Verified by: _______________
Date: _______________
