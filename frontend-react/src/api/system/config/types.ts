export interface ConfigVO extends BaseEntity {
  configId: number | string;
  configName: string;
  configKey: string;
  configValue: string;
  valueType?: ConfigValueType;
  defaultValue?: string | null;
  groupKey?: string | null;
  displayOrder?: number;
  optionsJson?: string | null;
  uiPropsJson?: string | null;
  configType: string;
  remark: string;
}

export interface ConfigForm {
  configId: number | string | undefined;
  configName: string;
  configKey: string;
  configValue: string;
  valueType?: ConfigValueType;
  defaultValue?: string | null;
  groupKey?: string | null;
  displayOrder?: number;
  optionsJson?: string | null;
  uiPropsJson?: string | null;
  configType: string;
  remark: string;
}

export interface ConfigQuery extends PageQuery {
  configName: string;
  configKey: string;
  configType: string;
}

export type ConfigValueType = 'switch' | 'select' | 'text' | 'password' | 'number' | 'textarea' | 'json' | string;

export interface ConfigOption {
  label: string;
  value: string;
}

export interface ConfigPanelItem {
  configId: number | string;
  configName: string;
  configKey: string;
  configValue: string;
  configType: string;
  valueType: ConfigValueType;
  defaultValue?: string | null;
  groupKey: string;
  displayOrder: number;
  options?: ConfigOption[] | null;
  uiProps?: Record<string, unknown>;
  editable: boolean;
  editableReason?: string | null;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ConfigPanelGroup {
  groupKey: string;
  groupName: string;
  displayOrder: number;
  items: ConfigPanelItem[];
}

export interface ConfigPanel {
  groups: ConfigPanelGroup[];
}

export interface ConfigReorderForm {
  configId: number | string;
  groupKey: string;
  displayOrder: number;
}
