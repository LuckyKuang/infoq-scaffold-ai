type ParseTimeInput = Date | string | number;
type TimeFormatKey = 'y' | 'm' | 'd' | 'h' | 'i' | 's' | 'a';
type DictEntry = {
  label: string | number;
  value: string | number;
};
type DictSource = DictEntry[] | Record<string, DictEntry>;
type SearchParamsCarrier = Record<string, unknown> & { params?: Record<string, unknown> };
type PrimitiveValue = string | number | boolean | null | undefined;
type TreeNode = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toDictEntries = (datas: DictSource): DictEntry[] => {
  return Array.isArray(datas) ? datas : Object.values(datas);
};

// 日期格式化
export function parseTime(time?: ParseTimeInput | null, pattern?: string) {
  if (arguments.length === 0 || !time) {
    return null;
  }
  const format = pattern || '{y}-{m}-{d} {h}:{i}:{s}';
  let date: Date;
  if (time instanceof Date) {
    date = time;
  } else {
    let timeValue: string | number = time;
    if (typeof timeValue === 'string' && /^[0-9]+$/.test(timeValue)) {
      timeValue = parseInt(timeValue, 10);
    } else if (typeof timeValue === 'string') {
      timeValue = timeValue.replace(/-/gm, '/').replace('T', ' ').replace(/\.[\d]{3}/gm, '');
    }
    if (typeof timeValue === 'number' && timeValue.toString().length === 10) {
      timeValue = timeValue * 1000;
    }
    date = new Date(timeValue);
  }
  const formatObj: Record<TimeFormatKey, number> = {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    h: date.getHours(),
    i: date.getMinutes(),
    s: date.getSeconds(),
    a: date.getDay()
  };
  return format.replace(/{(y|m|d|h|i|s|a)+}/g, (result: string, key: string) => {
    const formatKey = key as TimeFormatKey;
    const value = formatObj[formatKey];
    // Note: getDay() returns 0 on Sunday
    if (formatKey === 'a') {
      return ['日', '一', '二', '三', '四', '五', '六'][value];
    }
    if (result.length > 0 && value < 10) {
      return `0${value}`;
    }
    return String(value || 0);
  });
}

/**
 * 添加日期范围
 * @param params
 * @param dateRange
 * @param propName
 */
export const addDateRange = <T extends SearchParamsCarrier>(
  params: T,
  dateRange: Array<string | number | undefined>,
  propName?: string
): T & { params: Record<string, unknown> } => {
  const search = params as T & { params: Record<string, unknown> };
  search.params = isRecord(search.params) ? search.params : {};
  const currentDateRange = Array.isArray(dateRange) ? dateRange : [];
  if (typeof propName === 'undefined') {
    search.params.beginTime = currentDateRange[0];
    search.params.endTime = currentDateRange[1];
  } else {
    search.params[`begin${propName}`] = currentDateRange[0];
    search.params[`end${propName}`] = currentDateRange[1];
  }
  return search;
};

// 回显数据字典
export const selectDictLabel = (datas: DictSource, value: number | string | undefined) => {
  if (value === undefined) {
    return '';
  }
  const matched = toDictEntries(datas).find((item) => String(item.value) === String(value));
  return String(matched ? matched.label : value);
};

// 回显数据字典（字符串数组）
export const selectDictLabels = (
  datas: DictSource,
  value: string | number | Array<string | number> | undefined,
  separator?: string
) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const sourceValue = Array.isArray(value) ? value.join(',') : String(value);
  if (sourceValue.length === 0) {
    return '';
  }
  const currentSeparator = separator === undefined ? ',' : separator;
  const dictEntries = toDictEntries(datas);
  return sourceValue
    .split(currentSeparator)
    .map((item) => {
      const matched = dictEntries.find((entry) => String(entry.value) === item);
      return String(matched ? matched.label : item);
    })
    .join(currentSeparator);
};

// 字符串格式化(%s )
export function sprintf(str: string, ...args: unknown[]) {
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
export const parseStrEmpty = <T extends PrimitiveValue>(str: T): Exclude<T, null | undefined> | '' => {
  if (!str || str === 'undefined' || str === 'null') {
    return '';
  }
  return str as Exclude<T, null | undefined>;
};

// 数据合并
export const mergeRecursive = (source: Record<string, unknown>, target: Record<string, unknown>) => {
  for (const key of Object.keys(target)) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (isRecord(sourceValue) && isRecord(targetValue)) {
      source[key] = mergeRecursive(sourceValue, targetValue);
      continue;
    }
    source[key] = targetValue;
  }
  return source;
};

/**
 * 构造树型结构数据
 * @param {*} data 数据源
 * @param {*} id id字段 默认 'id'
 * @param {*} parentId 父节点字段 默认 'parentId'
 * @param {*} children 孩子节点字段 默认 'children'
 */
export const handleTree = <T extends object>(data: T[], id?: string, parentId?: string, children?: string): T[] => {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children'
  };

  const childrenListMap: Record<string, TreeNode> = {};
  const tree: TreeNode[] = [];
  const nodes = Array.isArray(data) ? (data as unknown as TreeNode[]) : [];

  for (const node of nodes) {
    childrenListMap[String(node[config.id])] = node;
  }

  for (const node of nodes) {
    const parentObj = childrenListMap[String(node[config.parentId])];
    if (!parentObj || parentObj === node) {
      tree.push(node);
    } else {
      if (!Array.isArray(parentObj[config.childrenList])) {
        parentObj[config.childrenList] = [];
      }
      const childList = parentObj[config.childrenList] as TreeNode[];
      const exists = childList.some((child) => child && child[config.id] === node[config.id]);
      if (!exists) {
        childList.push(node);
      }
    }
  }

  const trimEmptyChildren = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      const childList = node[config.childrenList];
      if (Array.isArray(childList)) {
        const validChildren = (childList as TreeNode[]).filter((child) => {
          if (!child) {
            return false;
          }
          const childId = child[config.id];
          return childId !== undefined && childId !== null && childId !== '';
        });
        if (validChildren.length === 0) {
          delete node[config.childrenList];
        } else {
          node[config.childrenList] = validChildren;
          trimEmptyChildren(validChildren);
        }
      }
    }
  };

  trimEmptyChildren(tree);
  return tree as T[];
};

/**
 * 参数处理
 * @param {*} params  参数
 */
export const tansParams = (params: Record<string, unknown>) => {
  let result = '';
  for (const propName of Object.keys(params)) {
    const value = params[propName];
    const part = encodeURIComponent(propName) + '=';
    if (value !== null && value !== '' && typeof value !== 'undefined') {
      if (isRecord(value) || Array.isArray(value)) {
        const nestedValue = value as Record<string, unknown>;
        for (const key of Object.keys(nestedValue)) {
          const subValue = nestedValue[key];
          if (subValue !== null && subValue !== '' && typeof subValue !== 'undefined') {
            const nestedKey = `${propName}[${key}]`;
            const subPart = encodeURIComponent(nestedKey) + '=';
            result += subPart + encodeURIComponent(String(subValue)) + '&';
          }
        }
      } else {
        result += part + encodeURIComponent(String(value)) + '&';
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
export const blobValidate = (data: unknown) => {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return true;
  }
  return (data as { type?: string }).type !== 'application/json';
};

export default {
  handleTree
};
