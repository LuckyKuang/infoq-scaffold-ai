type TimeInput = Date | string | number;
type DictValue = string | number;
type DictDataItem = { label: DictValue; value: DictValue };
type DictDataSource = DictDataItem[] | Record<string, DictDataItem>;
type QueryParams = Record<string, unknown>;
type MergeableRecord = Record<string, unknown>;
type TreeNode = Record<string, unknown>;

const isPlainObject = (value: unknown): value is MergeableRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && (value as { constructor?: unknown }).constructor === Object;
};

const toDictItems = (datas: DictDataSource): DictDataItem[] => {
  if (Array.isArray(datas)) {
    return datas;
  }
  return Object.values(datas);
};

// 日期格式化
export function parseTime(time?: TimeInput | null, pattern?: string): string | null {
  if (arguments.length === 0 || !time) {
    return null;
  }
  const format = pattern || '{y}-{m}-{d} {h}:{i}:{s}';
  let date: Date;
  let normalizedTime: TimeInput = time;

  if (normalizedTime instanceof Date) {
    date = normalizedTime;
  } else {
    if (typeof normalizedTime === 'string' && /^[0-9]+$/.test(normalizedTime)) {
      normalizedTime = parseInt(normalizedTime, 10);
    } else if (typeof normalizedTime === 'string') {
      normalizedTime = normalizedTime
        .replace(new RegExp(/-/gm), '/')
        .replace('T', ' ')
        .replace(new RegExp(/\.[\d]{3}/gm), '');
    }

    if (typeof normalizedTime === 'number' && normalizedTime.toString().length === 10) {
      normalizedTime = normalizedTime * 1000;
    }
    date = new Date(normalizedTime);
  }

  const formatObj: Record<'y' | 'm' | 'd' | 'h' | 'i' | 's' | 'a', number> = {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    h: date.getHours(),
    i: date.getMinutes(),
    s: date.getSeconds(),
    a: date.getDay()
  };

  return format.replace(/{(y|m|d|h|i|s|a)+}/g, (result: string, key: keyof typeof formatObj) => {
    let currentValue: string | number = formatObj[key];
    if (key === 'a') {
      return ['日', '一', '二', '三', '四', '五', '六'][currentValue];
    }
    if (result.length > 0 && Number(currentValue) < 10) {
      currentValue = `0${currentValue}`;
    }
    return String(currentValue || 0);
  });
}

/**
 * 添加日期范围
 * @param params
 * @param dateRange
 * @param propName
 */
export const addDateRange = <T extends QueryParams & { params?: QueryParams | null }>(
  params: T,
  dateRange: unknown[],
  propName?: string
): T & { params: QueryParams } => {
  const search = params;
  const normalizedParams = typeof search.params === 'object' && search.params !== null && !Array.isArray(search.params) ? search.params : {};
  const normalizedRange = Array.isArray(dateRange) ? dateRange : [];
  if (typeof propName === 'undefined') {
    normalizedParams.beginTime = normalizedRange[0];
    normalizedParams.endTime = normalizedRange[1];
  } else {
    normalizedParams[`begin${propName}`] = normalizedRange[0];
    normalizedParams[`end${propName}`] = normalizedRange[1];
  }
  search.params = normalizedParams;
  return search as T & { params: QueryParams };
};

// 回显数据字典
export const selectDictLabel = (datas: DictDataSource, value: DictValue | undefined): string => {
  if (value === undefined) {
    return '';
  }
  const selected = toDictItems(datas).find((item) => item.value == `${value}`);
  if (selected) {
    return String(selected.label);
  }
  return String(value);
};

// 回显数据字典（字符串数组）
export const selectDictLabels = (datas: DictDataSource, value: DictValue | DictValue[] | undefined, separator?: string): string => {
  if (value === undefined) {
    return '';
  }
  const currentSeparator = separator === undefined ? ',' : separator;
  const dictItems = toDictItems(datas);
  const normalizedValue = Array.isArray(value) ? value.join(',') : String(value);
  if (normalizedValue.length === 0) {
    return '';
  }
  const values = normalizedValue.split(currentSeparator);

  return values
    .map((itemValue) => {
      const matched = dictItems.find((dictItem) => dictItem.value == `${itemValue}`);
      return matched ? String(matched.label) : itemValue;
    })
    .join(currentSeparator);
};

// 字符串格式化(%s )
export function sprintf(str: string, ...args: unknown[]): string {
  if (typeof str !== 'string') {
    return '';
  }
  let flag = true;
  let i = 0;
  const formatted = str.replace(/%s/g, () => {
    const arg = args[i++];
    if (typeof arg === 'undefined') {
      flag = false;
      return '';
    }
    return String(arg);
  });
  return flag ? formatted : '';
}

// 转换字符串，undefined,null等转化为""
export const parseStrEmpty = (str: unknown): string => {
  if (str === undefined || str === null || str === 'undefined' || str === 'null' || str === '') {
    return '';
  }
  return String(str);
};

// 数据合并
export const mergeRecursive = <T extends MergeableRecord, U extends MergeableRecord>(source: T, target: U): T & U => {
  const sourceRecord = source as MergeableRecord;
  const targetRecord = target as MergeableRecord;
  for (const key in targetRecord) {
    try {
      const targetValue = targetRecord[key];
      const sourceValue = sourceRecord[key];
      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        sourceRecord[key] = mergeRecursive(sourceValue, targetValue);
      } else {
        sourceRecord[key] = targetValue;
      }
    } catch {
      sourceRecord[key] = targetRecord[key];
    }
  }
  return source as T & U;
};

/**
 * 构造树型结构数据
 * @param data 数据源
 * @param id id字段 默认 'id'
 * @param parentId 父节点字段 默认 'parentId'
 * @param children 孩子节点字段 默认 'children'
 */
export const handleTree = <T extends TreeNode>(data: T[], id?: string, parentId?: string, children?: string): T[] => {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children'
  };

  const childrenListMap = new Map<unknown, T>();
  const tree: T[] = [];
  for (const item of data) {
    const node = item as T & TreeNode;
    const nodeRecord = node as Record<string, unknown>;
    const nodeId = node[config.id];
    childrenListMap.set(nodeId, item);
    if (!Array.isArray(nodeRecord[config.childrenList])) {
      nodeRecord[config.childrenList] = [];
    }
  }

  for (const item of data) {
    const node = item as T & TreeNode;
    const currentParentId = node[config.parentId];
    const parentNode = childrenListMap.get(currentParentId) as (T & TreeNode) | undefined;
    if (!parentNode) {
      tree.push(item);
    } else {
      const childList = parentNode[config.childrenList] as unknown[];
      childList.push(item);
    }
  }
  return tree;
};

/**
 * 参数处理
 * @param params 参数
 */
export const tansParams = (params: QueryParams): string => {
  let result = '';
  for (const propName of Object.keys(params)) {
    const value = params[propName];
    const part = `${encodeURIComponent(propName)}=`;
    if (value !== null && value !== '' && typeof value !== 'undefined') {
      if (typeof value === 'object') {
        for (const key of Object.keys(value)) {
          const nestedValue = (value as Record<string, unknown>)[key];
          if (nestedValue !== null && nestedValue !== '' && typeof nestedValue !== 'undefined') {
            const nestedParams = `${propName}[${key}]`;
            const subPart = `${encodeURIComponent(nestedParams)}=`;
            result += `${subPart}${encodeURIComponent(String(nestedValue))}&`;
          }
        }
      } else {
        result += `${part}${encodeURIComponent(String(value))}&`;
      }
    }
  }
  return result;
};

// 返回项目路径
export const getNormalPath = (p: string): string => {
  if (p.length === 0 || !p || p === 'undefined') {
    return p;
  }
  const res = p.replace('//', '/');
  if (res[res.length - 1] === '/') {
    return res.slice(0, res.length - 1);
  }
  return res;
};

// 验证是否为blob格式
export const blobValidate = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return false;
  }
  return (data as { type?: string }).type !== 'application/json';
};

export default {
  handleTree
};
