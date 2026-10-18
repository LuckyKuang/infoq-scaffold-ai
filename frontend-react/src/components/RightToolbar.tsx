import { Button, Dropdown, Space, Tooltip } from 'antd';
import { AppstoreOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';

export type ToolbarColumn = {
  key: string;
  label: string;
  visible: boolean;
};

type RightToolbarProps = {
  showSearch?: boolean;
  search?: boolean;
  columns?: ToolbarColumn[];
  onShowSearchChange?: (value: boolean) => void;
  onQueryTable?: () => void;
  onColumnsChange?: (columns: ToolbarColumn[]) => void;
};

export default function RightToolbar({
  showSearch = true,
  search = true,
  columns,
  onShowSearchChange,
  onQueryTable,
  onColumnsChange
}: RightToolbarProps) {
  const columnItems =
    columns?.map((column) => ({
      key: column.key,
      label: column.label
    })) || [];

  const selectedKeys = (columns || []).filter((column) => column.visible).map((column) => column.key);

  return (
    <Space className="right-toolbar-actions" size={8}>
      {search && (
        <Tooltip title={showSearch ? '隐藏搜索' : '显示搜索'}>
          <Button
            shape="circle"
            icon={<SearchOutlined />}
            onClick={() => {
              onShowSearchChange?.(!showSearch);
            }}
          />
        </Tooltip>
      )}
      <Tooltip title="刷新">
        <Button shape="circle" icon={<ReloadOutlined />} onClick={() => onQueryTable?.()} />
      </Tooltip>
      {columns && columns.length > 0 && (
        <Tooltip title="显示/隐藏列">
          <Dropdown
            menu={{
              items: columnItems,
              selectable: true,
              multiple: true,
              selectedKeys,
              onSelect: ({ selectedKeys: keys }) => {
                const visibleKeys = new Set(keys);
                const next = columns.map((column) => ({
                  ...column,
                  visible: visibleKeys.has(column.key)
                }));
                onColumnsChange?.(next);
              },
              onDeselect: ({ selectedKeys: keys }) => {
                const visibleKeys = new Set(keys);
                const next = columns.map((column) => ({
                  ...column,
                  visible: visibleKeys.has(column.key)
                }));
                onColumnsChange?.(next);
              }
            }}
            trigger={['click']}
          >
            <Button shape="circle" icon={<AppstoreOutlined />} />
          </Dropdown>
        </Tooltip>
      )}
    </Space>
  );
}
