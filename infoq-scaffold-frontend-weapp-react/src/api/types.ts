export interface BaseEntity {
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
  remark?: string;
}

export interface PageQuery {
  pageNum: number;
  pageSize: number;
}

export interface ApiResult {
  code: number;
  msg?: string;
}

export interface ApiResponse<T> extends ApiResult {
  data: T;
}

export interface TableResponse<T> extends ApiResult {
  rows: T[];
  total: number;
}

export interface LoginData {
  username?: string;
  password?: string;
  rememberMe?: boolean;
  source?: string;
  code?: string;
  uuid?: string;
  clientId?: string;
  grantType?: string;
}

export interface ProfileOauthIdentityVO {
  identityId: number;
  providerCode: string;
  providerName: string;
  status: string;
  passwordConfirmationRequired: boolean;
}

export interface MessageRecipientVO {
  messageId: number;
  messageType: string;
  messageLevel: string;
  title: string;
  content?: string;
  source: string;
  createTime: string;
  expireTime?: string;
  readTime?: string;
}

export interface LoginResult {
  access_token: string;
}

export interface VerifyCodeResult {
  captchaEnabled: boolean;
  uuid?: string;
  img?: string;
}

export interface DictDataVO extends BaseEntity {
  dictCode?: string;
  dictLabel: string;
  dictValue: string;
  cssClass?: string;
  listClass?: string;
  dictSort?: number;
}

export interface DictTypeVO extends BaseEntity {
  dictId: string | number;
  dictName: string;
  dictType: string;
  status: string;
}

export interface DictTypeQuery extends PageQuery {
  dictName?: string;
  dictType?: string;
}

export interface DictDataQuery extends PageQuery {
  dictType?: string;
  dictLabel?: string;
}

export interface DictOption {
  label: string;
  value: string;
  cssClass?: string;
  listClass?: string;
}

export interface NoticeVO extends BaseEntity {
  noticeId: number;
  noticeTitle: string;
  noticeType: string;
  noticeContent: string;
  status: string;
  remark?: string;
  createByName?: string;
}

export interface NoticeQuery extends PageQuery {
  noticeTitle: string;
  createByName: string;
  status: string;
  noticeType: string;
}

export interface NoticeForm {
  noticeId?: number | string;
  noticeTitle: string;
  noticeType: string;
  noticeContent: string;
  status: string;
  remark?: string;
  createByName?: string;
}

export interface UserVO extends BaseEntity {
  userId?: string | number;
  deptId?: number;
  userName?: string;
  nickName?: string;
  userType?: string;
  email?: string;
  phonenumber?: string;
  sex?: string;
  avatar?: string;
  status?: string;
  delFlag?: string;
  loginIp?: string;
  loginDate?: string;
  deptName?: string;
  roles?: Array<Record<string, unknown>>;
  admin?: boolean;
}

export interface UserInfo {
  user: UserVO;
  roles: string[];
  permissions: string[];
}

export interface UserInfoVO {
  user: UserVO;
  roles?: RoleVO[];
  roleIds?: Array<string | number>;
  posts?: PostVO[];
  postIds?: Array<string | number>;
  roleGroup?: string;
  postGroup?: string;
}

export interface UserForm {
  id?: string;
  userId?: string;
  deptId?: number;
  userName?: string;
  nickName?: string;
  password?: string;
  phonenumber?: string;
  email?: string;
  sex?: string;
  status?: string;
  remark?: string;
  postIds?: Array<string | number>;
  roleIds?: Array<string | number>;
}

export interface UserProfileUpdatePayload {
  nickName?: string;
  email?: string;
  phonenumber?: string;
  sex?: string;
}

export interface UserQuery extends PageQuery {
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  status?: string;
  deptId?: string | number;
  roleId?: string | number;
  userIds?: string | number | Array<string | number>;
}

export interface DeptTreeVO extends BaseEntity {
  id: string | number;
  label: string;
  parentId: string | number;
  weight: number;
  children: DeptTreeVO[];
  disabled?: boolean;
}

export interface RoleVO extends BaseEntity {
  roleId: string | number;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope?: string;
  menuCheckStrictly?: boolean;
  deptCheckStrictly?: boolean;
  status: string;
  delFlag?: string;
  remark?: string;
  flag?: boolean;
  menuIds?: Array<string | number>;
  deptIds?: Array<string | number>;
  admin?: boolean;
}

export interface RoleQuery extends PageQuery {
  roleName: string;
  roleKey: string;
  status: string;
}

export interface RoleForm {
  roleId?: string | number;
  roleName: string;
  roleKey: string;
  roleSort: number;
  status: string;
  remark: string;
  dataScope?: string;
  menuCheckStrictly?: boolean;
  deptCheckStrictly?: boolean;
  menuIds?: Array<string | number>;
  deptIds?: Array<string | number>;
}

export interface DeptQuery extends PageQuery {
  deptName?: string;
  deptCategory?: string;
  status?: string | number;
}

export interface DeptVO extends BaseEntity {
  id?: string | number;
  parentName?: string;
  parentId: string | number;
  children: DeptVO[];
  deptId: string | number;
  deptName: string;
  deptCategory?: string;
  orderNum: number;
  leader?: string | number;
  phone?: string;
  email?: string;
  status?: string;
  delFlag?: string;
  ancestors?: string;
  menuId?: string | number;
}

export interface DeptForm {
  parentId?: string | number;
  deptId?: string | number;
  deptName?: string;
  deptCategory?: string;
  orderNum?: number;
  leader?: string | number;
  phone?: string;
  email?: string;
  status?: string;
  ancestors?: string;
}

export interface PostVO extends BaseEntity {
  postId: string | number;
  deptId: string | number;
  postCode: string;
  postName: string;
  postCategory?: string;
  deptName?: string;
  postSort: number;
  status?: string;
  remark?: string;
}

export interface PostForm {
  postId?: string | number;
  deptId?: string | number;
  postCode: string;
  postName: string;
  postCategory?: string;
  postSort: number;
  status?: string;
  remark?: string;
}

export interface PostQuery extends PageQuery {
  deptId?: string | number;
  belongDeptId?: string | number;
  postCode: string;
  postName: string;
  postCategory: string;
  status: string;
}

export type MenuType = 'M' | 'C' | 'F';

export interface MenuQuery {
  keywords?: string;
  menuName?: string;
  status?: string;
}

export interface MenuVO extends BaseEntity {
  parentName?: string;
  parentId: string | number;
  children: MenuVO[];
  menuId: string | number;
  menuName: string;
  orderNum: number;
  path?: string;
  component?: string;
  queryParam?: string;
  isFrame?: string;
  isCache?: string;
  menuType: MenuType;
  visible?: string;
  status?: string;
  icon?: string;
  remark?: string;
  perms?: string;
}

export interface MenuForm {
  parentId?: string | number;
  menuId?: string | number;
  menuName: string;
  orderNum: number;
  path?: string;
  component?: string;
  queryParam?: string;
  isFrame?: string;
  isCache?: string;
  menuType?: MenuType;
  visible?: string;
  status?: string;
  icon?: string;
  remark?: string;
  perms?: string;
}

export interface OnlineQuery extends PageQuery {
  ipaddr: string;
  userName: string;
}

export interface OnlineVO extends BaseEntity {
  tokenId: string;
  deptName?: string;
  userName: string;
  clientKey?: string;
  deviceType?: string;
  ipaddr: string;
  loginLocation?: string;
  browser?: string;
  os?: string;
  loginTime?: string | number;
}

export interface LoginInfoVO {
  infoId: string | number;
  userName: string;
  status: string;
  ipaddr?: string;
  loginLocation?: string;
  browser?: string;
  os?: string;
  msg?: string;
  loginTime?: string;
}

export interface LoginInfoQuery extends PageQuery {
  ipaddr: string;
  userName: string;
  status: string;
  orderByColumn: string;
  isAsc: string;
}

export interface OperLogQuery extends PageQuery {
  operIp: string;
  title: string;
  operName: string;
  businessType: string;
  status: string;
  orderByColumn: string;
  isAsc: string;
}

export interface OperLogVO extends BaseEntity {
  operId: string | number;
  title: string;
  businessType: number;
  method?: string;
  requestMethod?: string;
  operName?: string;
  deptName?: string;
  operUrl?: string;
  operIp?: string;
  operLocation?: string;
  operParam?: string;
  jsonResult?: string;
  status: number;
  errorMsg?: string;
  operTime?: string;
  costTime?: number;
}

export interface CacheVO {
  commandStats: Array<{ name: string; value: string }>;
  dbSize: number;
  info: Record<string, string>;
}
