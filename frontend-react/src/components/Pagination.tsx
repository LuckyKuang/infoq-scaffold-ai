import { Pagination as AntPagination } from 'antd';

export type PaginationPayload = {
  page: number;
  limit: number;
};

type PaginationProps = {
  total: number;
  page?: number;
  limit?: number;
  pageSizes?: number[];
  hidden?: boolean;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  onPageChange?: (payload: PaginationPayload) => void;
};

export default function Pagination({
  total,
  page = 1,
  limit = 20,
  pageSizes = [10, 20, 30, 50],
  hidden = false,
  showSizeChanger = true,
  showQuickJumper = true,
  onPageChange
}: PaginationProps) {
  if (hidden) {
    return null;
  }

  return (
    <div className="pagination-container-react">
      <AntPagination
        current={page}
        pageSize={limit}
        total={total}
        showSizeChanger={showSizeChanger}
        showQuickJumper={showQuickJumper}
        pageSizeOptions={pageSizes}
        showTotal={(currentTotal) => `共 ${currentTotal} 条`}
        onChange={(nextPage, nextSize) => {
          onPageChange?.({
            page: nextPage,
            limit: nextSize
          });
        }}
        onShowSizeChange={(nextPage, nextSize) => {
          const safePage = nextPage * nextSize > total ? 1 : nextPage;
          onPageChange?.({
            page: safePage,
            limit: nextSize
          });
        }}
      />
    </div>
  );
}
