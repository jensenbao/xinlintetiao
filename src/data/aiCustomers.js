import aiCustomersData from './aiCustomers.json';

export const CUSTOMER_CATEGORIES = aiCustomersData.customerCategories;

export const ALL_CATEGORY_IDS = Object.keys(CUSTOMER_CATEGORIES);

export const getCategoryConfig = (categoryId) => {
  return CUSTOMER_CATEGORIES[categoryId] || CUSTOMER_CATEGORIES.workplace;
};

export const randomInRange = (range) => {
  const [min, max] = range;
  return Math.random() * (max - min) + min;
};

export const pickRandom = (arr, count = 1) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return count === 1 ? shuffled[0] : shuffled.slice(0, count);
};

export const pickRandomMultiple = (arr, minCount = 1, maxCount = 3) => {
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
  const result = pickRandom(arr, Math.min(count, arr.length));
  return Array.isArray(result) ? result : [result];
};
