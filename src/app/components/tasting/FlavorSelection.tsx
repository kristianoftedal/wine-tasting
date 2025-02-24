import { Accordion } from "@/app/components/tasting/FlavorAccordion";
import { SelectedFlavors } from "@/app/components/tasting/SelectedFlavours";
import wineFlavorsData from "@/app/data/flavor.json";
import { Category, Flavor, Subcategory } from "@/app/models/flavorModel";
import { useAtom } from "jotai";
import { tastingAtom } from "../../store/tasting";

interface Props {
  type?: "lukt" | "smak";
}

export const FlavorSelection: React.FC<Props> = ({ type = "lukt" }) => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);

  const handleFlavorClick = (
    category: Category,
    subcategory: Subcategory,
    flavor: Flavor,
  ) => {
    setTastingState((prev) => {
      const key =
        type === "lukt" ? "selectedFlavorsLukt" : "selectedFlavorsSmak";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = prev[key] as any[];
      const updatedFlavors = existing.some((x) => x.flavor.name === flavor.name)
        ? existing.filter((x) => x.flavor.name !== flavor.name)
        : [...existing, { category, subcategory, flavor }];

      return { ...prev, [key]: updatedFlavors };
    });
  };

  return (
    <div>
      {wineFlavorsData.map((categoryItem) => (
        <Accordion
          key={categoryItem.name}
          category={categoryItem}
          subcategories={categoryItem.subcategories}
          onFlavorClick={handleFlavorClick}
        />
      ))}

      <SelectedFlavors
        selectedFlavors={
          tastingState[
            type === "lukt" ? "selectedFlavorsLukt" : "selectedFlavorsSmak"
          ]
        }
        onFlavorClick={handleFlavorClick}
      />

      <div className="field textarea border">
        <textarea
          value={tastingState[type]}
          onChange={(event) =>
            setTastingState((prev) => ({ ...prev, [type]: event.target.value }))
          }
        ></textarea>
        <span className="helper">Kommentar</span>
      </div>
    </div>
  );
};
