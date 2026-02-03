import type { SubcategoryData } from './types';

// Vinmonopolet-inspired wine aroma categories
// Each term belongs to exactly ONE category
export const WINE_CATEGORIES = {
  Frukt: {
    baer: {
      // Merged from old 'mørke bær' (1.7) and 'røde bær' (1.5) - averaged to 1.6
      terms: ['solbaer', 'bjoernbaer', 'blabaer', 'morell', 'kirsbaer', 'jordbaer', 'bringbaer', 'rips'],
      weight: 1.6
    },
    sitrus: {
      terms: ['sitrus', 'sitron', 'lime', 'grapefrukt'],
      weight: 1.5
    },
    steinfrukt: {
      terms: ['plomme', 'fersken', 'aprikos'],
      weight: 1.5
    },
    tropisk: {
      terms: ['tropisk', 'mango', 'ananas', 'melon'],
      weight: 1.4
    },
    toerket: {
      terms: ['toerket', 'moden', 'sviske', 'fiken', 'daddel', 'rosin'],
      weight: 1.6
    },
    annet: {
      terms: ['eple', 'paere'],
      weight: 1.4
    }
  },
  Krydder: {
    soet: {
      terms: ['vanilje', 'kanel'],
      weight: 1.7
    },
    varm: {
      terms: ['pepper', 'nellik'],
      weight: 1.7
    },
    annet: {
      terms: ['krydder', 'krydrete', 'anis', 'lakris'],
      weight: 1.7
    }
  },
  Urter: {
    groenn: {
      terms: ['gress', 'urter', 'urtete', 'timian', 'rosmarin', 'laurbaer', 'salvie'],
      weight: 1.3
    },
    annet: {
      terms: ['mynte', 'eukalyptus'],
      weight: 1.3
    }
  },
  Blomster: {
    annet: {
      terms: ['blomster', 'blomst', 'blomstrete', 'rose', 'fiol'],
      weight: 1.3
    }
  },
  'Eik/fat': {
    fatlagring: {
      terms: ['eik', 'fat', 'fatpreg', 'fatlagret'],
      weight: 1.8
    },
    ristet: {
      terms: ['toast', 'ristet'],
      weight: 1.8
    },
    annet: {
      terms: ['noett', 'kaffe', 'sjokolade', 'honning', 'karamell', 'smoer', 'kjeks', 'broed', 'broeddeig', 'brioche', 'tjaere', 'tobakk', 'laer'],
      weight: 1.4
    }
  },
  Mineral: {
    stein: {
      terms: ['mineralsk', 'mineralitet', 'mineraler', 'stein', 'steinet', 'flint'],
      weight: 1.5
    },
    annet: {
      terms: [],
      weight: 1.5
    }
  }
} as const satisfies Record<string, Record<string, SubcategoryData>>;

// Generic structure terms - LOWER weight (0.8) per user decision
// These are abstract qualities that don't demonstrate specific tasting skill
export const GENERIC_STRUCTURE_TERMS = {
  structure: {
    terms: ['struktur', 'balanse', 'tannin', 'snerp', 'garvestoffer'],
    weight: 0.8
  },
  quality: {
    terms: ['konsentrasjon', 'dybde', 'dyp', 'kompleks', 'sammensatt', 'elegant'],
    weight: 0.8
  },
  finish: {
    terms: ['ettersmak', 'avslutning', 'finish', 'lang', 'lengde'],
    weight: 0.8
  },
  body: {
    terms: ['fylde', 'fyldig', 'kropp', 'rik', 'intens'],
    weight: 0.8
  },
  acidity: {
    terms: ['friskhet', 'frisk', 'syre', 'syrlig', 'saftig'],
    weight: 0.8
  },
  sweetness: {
    terms: ['soedme', 'soet', 'toerr', 'halvtoerr'],
    weight: 0.8
  },
  texture: {
    terms: ['myk', 'rund', 'bloet', 'silkemyk', 'kremaktig', 'fast'],
    weight: 0.8
  },
  general: {
    terms: ['god', 'fin', 'pen', 'behagelig', 'tiltalende'],
    weight: 0.8
  }
} as const satisfies Record<string, SubcategoryData>;

// Type extraction helpers
export type WineCategoryKey = keyof typeof WINE_CATEGORIES;
export type GenericCategoryKey = keyof typeof GENERIC_STRUCTURE_TERMS;
