'use client';
import { ComboboxItem, ComboboxList, ComboboxProvider } from '@ariakit/react';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import * as RadixPopover from '@radix-ui/react-popover';
import { Box, Flex, TextField } from '@radix-ui/themes';
import React, { useRef, useState } from 'react';
import keyValues from '../data/wines-key-value.json';
import { searchModel } from '../models/searchModel';
import styles from './Search.module.css';

type SearchProperties = {
  onWineSelected: (wine: searchModel) => void;
};

export const Search: React.FC<SearchProperties> = ({ onWineSelected }) => {
  const [wines, setWines] = useState(new Array<searchModel>());
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e?.target.value.length < 3) return;
    const results = keyValues.filter(x =>
      x.productShortName.toLocaleLowerCase().includes(e.target.value.toLocaleLowerCase())
    );
    setWines(results);
    setOpen(results.length > 0);
  };

  const handleSelected = (wine: searchModel) => {
    setWines([]);
    onWineSelected(wine);
  };
  const comboboxRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  return (
    <Box>
      <RadixPopover.Root
        open={open}
        onOpenChange={setOpen}>
        <ComboboxProvider
          open={open}
          setOpen={setOpen}>
          <Flex direction="column">
            <TextField.Root
              placeholder="Finn din vin.."
              size={3}
              ref={comboboxRef}
              onChange={handleChange}>
              <TextField.Slot>
                <MagnifyingGlassIcon
                  height="16"
                  width="16"
                />
              </TextField.Slot>
            </TextField.Root>
          </Flex>
          <RadixPopover.Content
            asChild
            sideOffset={15}
            onOpenAutoFocus={event => event.preventDefault()}
            onInteractOutside={event => {
              const target = event.target as Element | null;
              const isCombobox = target === comboboxRef.current;
              const inListbox = target && listboxRef.current?.contains(target);
              if (isCombobox || inListbox) {
                event.preventDefault();
              }
            }}>
            <ComboboxList
              ref={listboxRef}
              role="listbox"
              className={styles.combobox}>
              {wines.map(x => (
                <ComboboxItem
                  focusOnHover
                  className={styles.option}
                  value={x.productId}
                  key={x.productId}
                  onClick={() => handleSelected(x)}>
                  {x.productShortName}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </RadixPopover.Content>
        </ComboboxProvider>
      </RadixPopover.Root>
    </Box>
  );
};
