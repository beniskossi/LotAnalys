const KEY_FAVORITES = 'lb_favorites';

export const getFavorites = (): number[] => {
  try {
    const stored = localStorage.getItem(KEY_FAVORITES);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const toggleFavorite = (num: number): number[] => {
  const favs = getFavorites();
  const idx = favs.indexOf(num);
  let newFavs;
  
  if (idx > -1) {
    newFavs = favs.filter(n => n !== num);
  } else {
    newFavs = [...favs, num].sort((a, b) => a - b);
  }
  
  localStorage.setItem(KEY_FAVORITES, JSON.stringify(newFavs));
  return newFavs;
};

export const isFavorite = (num: number): boolean => {
  return getFavorites().includes(num);
};
