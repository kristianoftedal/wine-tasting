# Requirements: Wine Tasting Similarity Scoring

**Defined:** 2026-02-02
**Core Value:** Specific tasting descriptors should contribute more to similarity scores than generic wine structure terms

## v1 Requirements

### Weight Profiles

- [ ] **WGHT-01**: Create three switchable weight profiles (inverted, moderate, data-driven)
- [ ] **WGHT-02**: Inverted profile: specific notes 2.0-2.5, generic terms 0.8-1.2
- [ ] **WGHT-03**: Moderate profile: specific notes 1.8-2.2, generic terms 1.0-1.5
- [ ] **WGHT-04**: Data-driven profile: weights based on database analysis
- [ ] **WGHT-05**: Easy configuration to switch between profiles

### Category Restructuring

- [ ] **CAT-01**: Merge "mørke bær" and "røde bær" into unified "frukt" category
- [ ] **CAT-02**: Align categories with Vinmonopolet tasting wheels (aromahjul/smakshjul)
- [ ] **CAT-03**: Structure: Frukt (bær, sitrus, steinfrukt, tropisk, tørket), Krydder, Urter, Blomster, Eik/fat, Mineral
- [ ] **CAT-04**: Lower category weight for generic structure terms (struktur, avslutning, fylde, friskhet, sødme)

### Data Analysis

- [ ] **DATA-01**: Query Supabase to extract all smell/taste notes from wines table
- [ ] **DATA-02**: Analyze frequency of terms to identify common vocabulary
- [ ] **DATA-03**: Identify missing terms not in current lemmas
- [ ] **DATA-04**: Fix typos in existing lemmas based on actual usage

### Quality & Compatibility

- [ ] **QUAL-01**: Maintain localhost/server split functionality
- [ ] **QUAL-02**: Local similarity works with Xenova embeddings
- [ ] **QUAL-03**: Server similarity works with OpenAI embeddings
- [ ] **QUAL-04**: No breaking changes to existing API signatures

### Validation

- [ ] **VAL-01**: Create test cases with known note pairs
- [ ] **VAL-02**: Compare before/after scores for test cases
- [ ] **VAL-03**: Manual verification in app with real tastings

## v2 Requirements

### Future Enhancements

- **BONUS-01**: Bonus point system for identifying rare/specific notes
- **BONUS-02**: Progressive scoring that rewards more detailed descriptions
- **UI-01**: Visual feedback showing which terms contributed to score

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changing ML model | Current Xenova model sufficient for this iteration |
| UI changes | Focus on scoring logic only |
| Real-time score preview | Would require significant frontend changes |
| Multi-language support | Norwegian only for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WGHT-01 | TBD | Pending |
| WGHT-02 | TBD | Pending |
| WGHT-03 | TBD | Pending |
| WGHT-04 | TBD | Pending |
| WGHT-05 | TBD | Pending |
| CAT-01 | TBD | Pending |
| CAT-02 | TBD | Pending |
| CAT-03 | TBD | Pending |
| CAT-04 | TBD | Pending |
| DATA-01 | TBD | Pending |
| DATA-02 | TBD | Pending |
| DATA-03 | TBD | Pending |
| DATA-04 | TBD | Pending |
| QUAL-01 | TBD | Pending |
| QUAL-02 | TBD | Pending |
| QUAL-03 | TBD | Pending |
| QUAL-04 | TBD | Pending |
| VAL-01 | TBD | Pending |
| VAL-02 | TBD | Pending |
| VAL-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
