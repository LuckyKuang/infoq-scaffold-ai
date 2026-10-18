export interface InviteCodeVO extends BaseEntity {
  inviteId: number | string;
  inviteCode: string;
  status: string;
  usedUserId?: number | string;
  usedUserEmail?: string;
  creatorName?: string;
  expireTime?: string;
  usedTime?: string;
  canceledTime?: string;
  canceledReason?: string;
  remark?: string;
}

export interface InviteCodeQuery extends PageQuery {
  inviteCode?: string;
  status?: string;
  usedUserEmail?: string;
  creatorName?: string;
}

export interface InviteCodeGenerateForm {
  generateCount: number;
  expireTime?: string;
  remark?: string;
}

export interface InviteCodeCancelForm {
  inviteId: number | string;
  canceledReason: string;
}
