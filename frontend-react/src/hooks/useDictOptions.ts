import { useEffect, useMemo, useState } from 'react';
import { getDicts } from '@/api/system/dict/data';
import type { DictDataVO } from '@/api/system/dict/data/types';

const dictCache = new Map<string, DictDataOption[]>();

const mapDictDataToOption = (item: DictDataVO): DictDataOption => ({
  label: item.dictLabel,
  value: item.dictValue,
  elTagType: item.listClass || undefined,
  elTagClass: item.cssClass || undefined
});

export default function useDictOptions(...types: string[]) {
  const typeKey = types.filter(Boolean).join('|');
  const uniqueTypes = useMemo(() => Array.from(new Set(typeKey.split('|').filter(Boolean))), [typeKey]);
  const [optionsMap, setOptionsMap] = useState<Record<string, DictDataOption[]>>(() =>
    uniqueTypes.reduce<Record<string, DictDataOption[]>>((result, type) => {
      result[type] = dictCache.get(type) || [];
      return result;
    }, {})
  );

  useEffect(() => {
    setOptionsMap((prev) => {
      const next = { ...prev };
      uniqueTypes.forEach((type) => {
        next[type] = dictCache.get(type) || [];
      });
      return next;
    });

    const pendingTypes = uniqueTypes.filter((type) => !dictCache.has(type));
    if (pendingTypes.length === 0) {
      return;
    }

    let mounted = true;

    const loadDicts = async () => {
      const entries = await Promise.all(
        pendingTypes.map(async (type) => {
          try {
            const response = await getDicts(type);
            const mapped = response.data.map(mapDictDataToOption);
            dictCache.set(type, mapped);
            return [type, mapped] as const;
          } catch {
            const emptyOptions: DictDataOption[] = [];
            dictCache.set(type, emptyOptions);
            return [type, emptyOptions] as const;
          }
        })
      );

      if (!mounted) {
        return;
      }

      setOptionsMap((prev) => {
        const next = { ...prev };
        entries.forEach(([type, value]) => {
          next[type] = value;
        });
        return next;
      });
    };

    loadDicts();

    return () => {
      mounted = false;
    };
  }, [uniqueTypes]);

  return uniqueTypes.reduce<Record<string, DictDataOption[]>>((result, type) => {
    result[type] = optionsMap[type] || [];
    return result;
  }, {});
}
