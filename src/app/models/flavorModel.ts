// Define the Flavor type as a type alias
export type Flavor = {
  name: string; // Name of the flavor
  description?: string | undefined;
  backgroundColor?: string;
};

// Define the Subcategory type as a type alias
export type Subcategory = {
  name: string; // Name of the subcategory
  description?: string | undefined; // Description of the subcategory
  flavors: Flavor[]; // List of flavors in this subcategory
  backgroundColor?: string | undefined;
  icon?: string | undefined;
};

// Define the Category type as a type alias
export type Category = {
  name: string; // Name of the category
  description?: string | undefined; // Description of the category
  subcategories: Subcategory[]; // List of subcategories in this category
  backgroundColor?: string | undefined;
  icon?: string | undefined;
  image?: string | undefined;
};

export type SelectedFlavor = {
  category: Category;
  subcategory: Subcategory;
  flavor: Flavor;
};
