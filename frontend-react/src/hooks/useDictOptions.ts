import { useEffect, useMemo, useState } from 'react';
import { getDicts } from '@/api/system/dict/data';
import type { DictDataVO } from '@/api/system/dict/data/types';

const dictCache = new Map<string, DictDataOption[]>();
// 清理缓存时递增，丢弃清理前已发出的请求结果，避免旧数据回写缓存
let cacheGeneration = 0;

/** 清理字典缓存：传入类型只清理该类型，不传则清理全部；字典数据/类型变更或刷新缓存后调用 */
export const clearDictCache = (dictType?: string) => {
  cacheGeneration += 1;
  if (dictType) {
    dictCache.delete(dictType);
    return;
  }
  dictCache.clear();
};

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
          const generation = cacheGeneration;
          try {
            const response = await getDicts(type);
            const mapped = response.data.map(mapDictDataToOption);
            if (generation === cacheGeneration) {
              dictCache.set(type, mapped);
            }
            return [type, mapped] as const;
          } catch {
            // 失败不写缓存，下次使用时重新请求；错误提示由请求层负责
            return [type, [] as DictDataOption[]] as const;
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
