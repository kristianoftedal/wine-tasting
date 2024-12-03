'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Accordion } from '@/app/components/flavorAccordion';
import { SelectedFlavors } from '@/app/components/selectedFlavours';
import { Category, Flavor, SelectedFlavor, Subcategory } from '@/app/models/flavorModel';
import { Wine } from '@/app/models/productModel';
import Image from 'next/image';
import wineFlavorsData from '../../data/flavor.json';
import winesData from '../../data/wines.json';

type Step = {
  title: string;
};

export default function Tasting() {
  const params = useParams<{ id: string }>();
  const wine = winesData.find((x: Wine) => x.code === params.id);
  const [selectedFlavors, setSelectedFlavors] = useState<SelectedFlavor[]>([]);
  const [index, setIndex] = useState<number>(0);

  const [friskhet, setFriskhet] = useState<number>(0);

  const [fylde, setFylde] = useState<number>(0);

  const [sødme, setSødme] = useState<number>(0);

  const [karakter, setKarakter] = useState<number>(0);

  const [steps] = useState<Step[]>([{ title: 'Se' }, { title: 'Aroma' }, { title: 'Smak' }, { title: 'Egenskaper' }]);

  const handleFlavorClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setSelectedFlavors(prev => {
      const categoryFlavors = prev.length === 0 ? [] : prev;
      const updatedFlavors = categoryFlavors.some(x => x.flavor.name == flavor.name)
        ? categoryFlavors.filter(x => x.flavor.name !== flavor.name)
        : [...categoryFlavors, { category, subcategory, flavor }];
      return updatedFlavors;
    });
  };

  if (!wine)
    return (
      <article className="medium middle-align center-align">
        <div>
          <i className="extra">bottle</i>
          <h5>Vi kunne dessverre ikke finne denne vinen</h5>
          <p>Click the button to start a conversation</p>
          <div className="space"></div>
          <nav className="center-align">
            <button>Tilbake</button>
          </nav>
        </div>
      </article>
    );

  return (
    <>
      <header className="primary-container">
        <nav>
          <button className="circle transparent">
            <i>arrow_back</i>
          </button>
          <h5 className="max">{wine.name}</h5>
        </nav>
      </header>
      <main
        className="responsive max"
        key={'unique'}>
        {index === 0 && (
          <article>
            <div className="row">
              <Image
                height={96}
                width={96}
                className="circle large"
                alt={wine?.images[3].altText}
                src={wine?.images[3].url}
              />
              <div className="max">
                <p>Druer: {wine.content.ingredients.map(x => x.formattedValue).join(', ')}</p>
                <p>Land: {wine.main_country.name}</p>
                <p>Område: {wine.district.name}</p>
                <p>Årgang: {wine.year}</p>
                <p>Nr: {index + 1}</p>
                <div className="field border">
                  <input type="text" />
                  <span className="helper">Farge</span>
                </div>
              </div>
            </div>
          </article>
        )}
        {index === 1 && (
          <div>
            {wineFlavorsData.map(categoryItem => (
              <div key={categoryItem.name}>
                <Accordion
                  key={categoryItem.name}
                  category={categoryItem}
                  subcategories={categoryItem.subcategories}
                  onFlavorClick={handleFlavorClick}
                />
              </div>
            ))}

            <SelectedFlavors
              selectedFlavors={selectedFlavors}
              onFlavorClick={handleFlavorClick}
            />
          </div>
        )}
        {index === 2 && (
          <div>
            {wineFlavorsData.map(categoryItem => (
              <div key={categoryItem.name}>
                <Accordion
                  key={categoryItem.name}
                  category={categoryItem}
                  subcategories={categoryItem.subcategories}
                  onFlavorClick={handleFlavorClick}
                />
              </div>
            ))}

            <SelectedFlavors
              selectedFlavors={selectedFlavors}
              onFlavorClick={handleFlavorClick}
            />
          </div>
        )}
        {index === 3 && (
          <div className="grid">
            <div className="l12 s12">
              <div
                className="center middle-align row"
                style={{ marginTop: 0 }}>
                Friskhet
              </div>
              <div className="row">
                <p>1</p>
                <label className="slider">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    onChange={value => setFriskhet(parseInt(value.target.value))}
                  />
                  <span></span>
                </label>
                12
              </div>
              <div
                className="center middle-align row"
                style={{ marginTop: 0, marginBottom: '8px' }}>
                {friskhet}
              </div>
              <hr />
            </div>

            <div className="l12 s12">
              <div
                className="center middle-align row"
                style={{ marginTop: 0 }}>
                Fylde
              </div>
              <div className="row">
                <p>1</p>
                <label className="slider">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    onChange={value => setFylde(parseInt(value.target.value))}
                  />
                  <span></span>
                </label>
                <p>12</p>
              </div>
              <div
                className="center middle-align row"
                style={{ marginTop: 0, marginBottom: '8px' }}>
                {fylde}
              </div>
              <hr />
            </div>

            <div className="l12 s12">
              <div
                className="center middle-align row"
                style={{ marginTop: 0 }}>
                Sødme
              </div>
              <div className="row">
                <p>1</p>
                <label className="slider">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    onChange={value => setSødme(parseInt(value.target.value))}
                  />
                  <span></span>
                </label>
                <p>12</p>
              </div>
              <div
                className="center middle-align row"
                style={{ marginTop: 0, marginBottom: '8px' }}>
                {sødme}
              </div>
              <hr />
            </div>

            <div className="l12 s12">
              <div
                className="center middle-align row"
                style={{ marginTop: 0 }}>
                Hvor god er vinen?
              </div>
              <div className="row">
                <p>1</p>
                <label className="slider">
                  <input
                    type="range"
                    min="1"
                    max="6"
                    onChange={value => setKarakter(parseInt(value.target.value))}
                  />
                  <span></span>
                </label>
                <p>12</p>
              </div>
              <div
                className="center middle-align row"
                style={{ marginTop: 0, marginBottom: '8px' }}>
                {karakter}
              </div>
              <hr />
            </div>
          </div>
        )}
      </main>
      <footer>
        <nav className="padding">
          {index > 0 && (
            <button
              className="circle transparent"
              onClick={() => setIndex(index > 0 ? index - 1 : 0)}>
              <i>arrow_back</i>
              Forrige
            </button>
          )}
          <h6 className="max center-align">{steps[index]?.title}</h6>
          {index <= steps.length && (
            <button
              className="circle transparent"
              onClick={() => setIndex(index + 1 <= steps.length ? index + 1 : index)}>
              {steps[index + 1]?.title}
              <i>arrow_forward</i>
            </button>
          )}
        </nav>
      </footer>
    </>
  );
}
