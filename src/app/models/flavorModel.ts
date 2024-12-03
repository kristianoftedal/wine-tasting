// Define the Flavor type as a type alias
export type Flavor = {
  name: string; // Name of the flavor
  icon: string; // Icon representing the flavor (e.g., emoji)
  description?: string;
  backgroundColor?: string;
};

// Define the Subcategory type as a type alias
export type Subcategory = {
  name: string; // Name of the subcategory
  description?: string; // Description of the subcategory
  flavors: Flavor[]; // List of flavors in this subcategory
  backgroundColor?: string;
};

// Define the Category type as a type alias
export type Category = {
  name: string; // Name of the category
  description?: string; // Description of the category
  subcategories: Subcategory[]; // List of subcategories in this category
  backgroundColor?: string;
};

export type SelectedFlavor = {
  category: Category;
  subcategory: Subcategory;
  flavor: Flavor;
};
