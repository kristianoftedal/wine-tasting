'use client';

import React, { useState } from 'react';
import { Accordion } from '@/app/components/flavorAccordion';
import { SelectedFlavors } from '@/app/components/selectedFlavours';
import { Category, Flavor, SelectedFlavor, Subcategory } from '@/app/models/flavorModel';
import wineFlavorsData from '../data/flavor.json';
import { Wine } from '../models/productModel';
import { useRouter } from 'next/navigation';

type Step = {
  title: string;
};

type TastingWizardProps = {
  wine: Wine;
}


export const TastingWizard: React.FC<TastingWizardProps> = ({ wine }) => {

  const router = useRouter();

  const [index, setIndex] = useState<number>(0);
  const [steps] = useState<Step[]>([
    { title: 'Se' },
    { title: 'Aroma' },
    { title: 'Smak' },
    { title: 'Egenskaper' },
    { title: 'Oppsummering' }
  ]);

  const [selectedFlavorsLukt, setSelectedFlavorsLukt] = useState<SelectedFlavor[]>([]);
  const [selectedFlavorsSmak, setSelectedFlavorsSmak] = useState<SelectedFlavor[]>([]);

  const [farge, setFarge] = useState<string>('');
  const [lukt, setLukt] = useState<string>('');
  const [smak, setSmak] = useState<string>('');

  const [friskhet, setFriskhet] = useState<number>(0);
  const [fylde, setFylde] = useState<number>(0);
  const [sødme, setSødme] = useState<number>(0);
  const [karakter, setKarakter] = useState<number>(0);
  const [egenskaper, setKommentarEgenskaper] = useState<string>('');

  const [showWine, setShowWine] = useState<boolean>(false);

  const handleFlavorLuktClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setSelectedFlavorsLukt(prev => {
      const categoryFlavors = prev.length === 0 ? [] : prev;
      const updatedFlavors = categoryFlavors.some(x => x.flavor.name == flavor.name)
        ? categoryFlavors.filter(x => x.flavor.name !== flavor.name)
        : [...categoryFlavors, { category, subcategory, flavor }];
      return updatedFlavors;
    });
  };
  const handleFlavorSmakClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setSelectedFlavorsSmak(prev => {
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
            <button onClick={() => router.push('/')}>Tilbake</button>
          </nav>
        </div>
      </article>
    );

  return (
    <>
      <header className="primary-container">
        <nav>
          <button
            className="circle transparent"
            onClick={() => router.push('/')}>
            <i>arrow_back</i>
          </button>
          <h5 className="max">{wine.name}</h5>
        </nav>
      </header>
      <main
        className="responsive"
        key={'unique'}>
        {index === 0 && (
          <article>
            <div className="row">
              <div className="max">
                <p>Druer: {wine.content.ingredients?.map(x => x.formattedValue).join(', ')}</p>
                <p>Land: {wine.mainCountry.name}</p>
                <p>Område: {wine.district.name}</p>
                <p>Årgang: {wine.year}</p>
                <p>Nr: {index + 1}</p>
                <div className="field border">
                  <input
                    type="text"
                    value={farge}
                    onChange={event => setFarge(event.target.value)}
                  />
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
                  onFlavorClick={handleFlavorLuktClick}
                />
              </div>
            ))}

            <SelectedFlavors
              selectedFlavors={selectedFlavorsLukt}
              onFlavorClick={handleFlavorLuktClick}
            />
            <div className="field textarea border">
              <textarea
                value={lukt}
                onChange={value => setLukt(value.target.value)}></textarea>
              <span className="helper">Kommentar</span>
            </div>
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
                  onFlavorClick={handleFlavorSmakClick}
                />
              </div>
            ))}

            <SelectedFlavors
              selectedFlavors={selectedFlavorsSmak}
              onFlavorClick={handleFlavorSmakClick}
            />
            <div className="field textarea border">
              <textarea
                value={smak}
                onChange={event => setSmak(event.target.value)}></textarea>
              <span className="helper">Kommentar</span>
            </div>
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
                <label className="max">
                  <input
                    style={{ width: '100%' }}
                    type="range"
                    min="1"
                    max="12"
                    value={friskhet}
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
                <label className="max">
                  <input
                    style={{ width: '100%' }}
                    type="range"
                    min="1"
                    max="12"
                    value={fylde}
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
                <label className="max">
                  <input
                    style={{ width: '100%' }}
                    type="range"
                    min="1"
                    max="12"
                    value={sødme}
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
                <label className="max">
                  <input
                    style={{ width: '100%' }}
                    type="range"
                    min="1"
                    max="6"
                    value={karakter}
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
            <div className="l12 s12">
              <div className="field textarea border">
                <textarea
                  value={egenskaper}
                  onChange={event => setKommentarEgenskaper(event.target.value)}></textarea>
                <span className="helper">Kommentar</span>
              </div>
            </div>
          </div>
        )}
        {index === 4 && (
          <article>
            <div className="row">
              <div className="max">
                <p>Farge: {farge}</p>
                <p>Lukt: {lukt}</p>
                <p>{selectedFlavorsLukt.map(x => x.flavor.name).join(', ')}</p>
                <hr />
                <p>Smak: {smak}</p>
                <p>{selectedFlavorsSmak.map(x => x.flavor.name).join(', ')}</p>
                <hr />
                <p>Friskhet: {friskhet}</p>
                <p>Fylde: {fylde}</p>
                <p>Sødme: {sødme}</p>
                <p>Karakter: {karakter}</p>
                <p>Kommentar: {egenskaper}</p>
              </div>
            </div>
            <div className="row">
              <div className="max">
                <label className="switch">
                  <input
                    type="checkbox"
                    onChange={() => setShowWine(!showWine)}
                  />
                  <span style={{ paddingLeft: '8px' }}> Sammenlign</span>
                </label>
              </div>
            </div>
            {showWine && (
              <div className="row">
                <div className="max">
                  <p>Farge: {wine.color}</p>
                  <p>Lukt: {wine.smell}</p>
                  <p>Smak: {wine.taste}</p>
                  {wine.content.characteristics.map(x => (
                    <p key={x.name}>{x.readableValue}</p>
                  ))}
                </div>
              </div>
            )}
          </article>
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

