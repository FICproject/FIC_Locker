import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { apiClient } from './client';
import {
  API_CONFIG,
  DEFAULT_CATEGORIES,
  DEV_CANDIDATE_HOSTS,
  resolveDevHost,
  setApiHostOverride,
} from '../../constants';
import { CategoryItem } from '../../types';

const CATEGORIES_CACHE_KEY = '@fic_locker_cached_categories';

const COLOR_PALETTE = [
  '#6C47FF',
  '#4F46E5',
  '#7C3AED',
  '#2563EB',
  '#E11D48',
  '#059669',
  '#D97706',
  '#0D9488',
  '#EC4899',
  '#3B82F6',
];

export function getCategoryEmoji(name?: string, icon?: string): string {
  const n = (name || '').toLowerCase();
  const ic = (icon || '').toLowerCase();

  if (n.includes('personal') || ic === 'user') return '👤';
  if (n.includes('identity') || ic.includes('id') || ic.includes('shield')) return '🛡️';
  if (n.includes('education') || ic.includes('grad') || ic.includes('book')) return '🎓';
  if (n.includes('financial') || ic.includes('wallet') || ic.includes('credit') || ic.includes('money')) return '💰';
  if (n.includes('medical') || ic.includes('plus') || ic.includes('heart')) return '➕';
  if (
    n.includes('warrant') ||
    n.includes('bill') ||
    n.includes('receipt') ||
    n.includes('invoice') ||
    n.includes('paper')
  ) {
    return '🧾';
  }
  if (n.includes('vehicle') || n.includes('car') || ic.includes('car')) return '🚗';
  if (n.includes('work') || n.includes('job') || n.includes('office') || ic.includes('briefcase')) return '💼';
  if (n.includes('home') || n.includes('house') || n.includes('property') || ic.includes('home')) return '🏠';
  return '📁';
}

function normalizeCategories(rawList: any[]): CategoryItem[] {
  if (!Array.isArray(rawList)) return [];

  return rawList
    .filter((c) => c && (c.name || c.id || c._id))
    .map((c, index) => {
      const id = String(c.id || c._id || index + 1);
      const name = String(c.name || 'Other Documents');
      const color = c.color && c.color !== '#6C47FF' ? c.color : COLOR_PALETTE[index % COLOR_PALETTE.length];
      return {
        id,
        _id: String(c._id || id),
        name,
        slug: c.slug || '',
        description: c.description || '',
        icon: c.icon || 'folder',
        color,
        isSystemDefault: !!c.isSystemDefault,
        isActive: c.isActive !== false,
        documentCount: typeof c.documentCount === 'number' ? c.documentCount : 0,
      };
    });
}

export const categoryService = {
  async getCachedCategories(): Promise<CategoryItem[]> {
    try {
      const cached = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeCategories(parsed);
        }
      }
    } catch (e) {
      console.warn('[categoryService] Error reading cached categories:', e);
    }
    return normalizeCategories(DEFAULT_CATEGORIES);
  },

  async fetchCategories(): Promise<CategoryItem[]> {
    // 1. Try apiClient
    try {
      const res = await apiClient.get<any>(API_CONFIG.ENDPOINTS.CATEGORIES);
      const raw = res.data?.categories ?? res.data?.data ?? res.data;
      if (Array.isArray(raw) && raw.length > 0) {
        const normalized = normalizeCategories(raw);
        await AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (err) {
      console.warn('[categoryService] Primary apiClient fetch failed, scanning candidate hosts...', err);
    }

    // 2. Fallback candidate hosts (physical Android device USB adb reverse / WiFi LAN / emulator)
    const candidates = [
      resolveDevHost(),
      ...DEV_CANDIDATE_HOSTS,
    ].filter((h, i, arr) => h && arr.indexOf(h) === i);

    for (const host of candidates) {
      try {
        const url = `http://${host}:5000/api/v1${API_CONFIG.ENDPOINTS.CATEGORIES}`;
        const res = await axios.get(url, { timeout: 3500 });
        const raw = res.data?.categories ?? res.data?.data ?? res.data;
        if (Array.isArray(raw) && raw.length > 0) {
          setApiHostOverride(host);
          const normalized = normalizeCategories(raw);
          await AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(normalized));
          return normalized;
        }
      } catch {
        // Continue searching candidates
      }
    }

    // 3. Fallback to cached or default
    return this.getCachedCategories();
  },
};

