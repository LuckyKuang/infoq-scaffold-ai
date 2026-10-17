INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, remark, create_time)
VALUES (1000, 2, 'No', 'N', 'sys_yes_no', '', '', 'N', 'second', TIMESTAMP '2026-03-01 10:00:00');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, remark, create_time)
VALUES (1001, 1, 'Yes', 'Y', 'sys_yes_no', '', '', 'Y', 'first', TIMESTAMP '2026-03-01 09:00:00');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, remark, create_time)
VALUES (1002, 1, 'Enabled', '1', 'sys_normal_disable', '', '', 'Y', 'other type', TIMESTAMP '2026-03-01 08:00:00');

INSERT INTO sys_role (role_id, role_name, role_key, role_sort, data_scope, status, del_flag)
VALUES (10, 'admin', 'admin', 1, '1', '0', '0');
INSERT INTO sys_role (role_id, role_name, role_key, role_sort, data_scope, status, del_flag)
VALUES (11, 'audit', 'audit', 2, '1', '1', '0');
INSERT INTO sys_role (role_id, role_name, role_key, role_sort, data_scope, status, del_flag)
VALUES (12, 'deleted', 'deleted', 3, '1', '0', '1');

INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, del_flag)
VALUES (100, 0, '0', 'RootDept', 1, 501, '0');
INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, del_flag)
VALUES (101, 100, '0,100', 'ChildDeptA', 1, 501, '0');
INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, del_flag)
VALUES (102, 100, '0,100', 'ChildDeptB', 2, 501, '0');
INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, del_flag)
VALUES (103, 0, '0', 'DeletedDept', 3, 501, '1');

INSERT INTO sys_role_dept (role_id, dept_id) VALUES (10, 100);
INSERT INTO sys_role_dept (role_id, dept_id) VALUES (10, 101);
INSERT INTO sys_role_dept (role_id, dept_id) VALUES (10, 103);

INSERT INTO sys_menu (menu_id, parent_id, order_num, perms, status)
VALUES (1, 0, 1, NULL, '0');
INSERT INTO sys_menu (menu_id, parent_id, order_num, perms, status)
VALUES (2, 1, 1, 'system:user:list', '0');
INSERT INTO sys_menu (menu_id, parent_id, order_num, perms, status)
VALUES (3, 1, 2, '', '0');
INSERT INTO sys_menu (menu_id, parent_id, order_num, perms, status)
VALUES (4, 0, 2, 'system:menu:view', '0');
INSERT INTO sys_menu (menu_id, parent_id, order_num, perms, status)
VALUES (5, 0, 3, NULL, '0');

INSERT INTO sys_role_menu (role_id, menu_id) VALUES (10, 1);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (10, 2);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (10, 3);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (10, 4);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (10, 5);

INSERT INTO sys_user (user_id, dept_id, user_name, nick_name, email, avatar, phonenumber, sex, status, del_flag, login_ip, login_date, create_by, create_time, remark)
VALUES (501, 101, 'alice', 'Alice', 'alice@example.com', 0, '13800000001', '0', '0', '0', '127.0.0.1', TIMESTAMP '2026-03-01 11:00:00', 1, TIMESTAMP '2026-03-01 09:00:00', 'seed');
INSERT INTO sys_user (user_id, dept_id, user_name, nick_name, email, avatar, phonenumber, sex, status, del_flag, login_ip, login_date, create_by, create_time, remark)
VALUES (502, 101, 'bob', 'Bob', 'bob@example.com', 0, '13800000002', '0', '0', '0', '127.0.0.1', TIMESTAMP '2026-03-01 11:10:00', 1, TIMESTAMP '2026-03-01 09:10:00', 'seed');
INSERT INTO sys_user (user_id, dept_id, user_name, nick_name, email, avatar, phonenumber, sex, status, del_flag, login_ip, login_date, create_by, create_time, remark)
VALUES (503, 102, 'charlie', 'Charlie', 'charlie@example.com', 0, '13800000003', '1', '0', '0', '127.0.0.1', TIMESTAMP '2026-03-01 11:20:00', 1, TIMESTAMP '2026-03-01 09:20:00', 'seed');
INSERT INTO sys_user (user_id, dept_id, user_name, nick_name, email, avatar, phonenumber, sex, status, del_flag, login_ip, login_date, create_by, create_time, remark)
VALUES (504, 101, 'deleted', 'Deleted', 'deleted@example.com', 0, '13800000004', '0', '0', '1', '127.0.0.1', TIMESTAMP '2026-03-01 11:30:00', 1, TIMESTAMP '2026-03-01 09:30:00', 'seed');

INSERT INTO sys_user_role (user_id, role_id) VALUES (501, 10);
INSERT INTO sys_user_role (user_id, role_id) VALUES (501, 12);
INSERT INTO sys_user_role (user_id, role_id) VALUES (502, 11);

INSERT INTO sys_post (post_id, dept_id, post_code, post_name, post_category, post_sort, status, remark, create_time)
VALUES (300, 101, 'dev', 'Developer', 'tech', 1, '0', 'seed', TIMESTAMP '2026-03-01 12:00:00');
INSERT INTO sys_post (post_id, dept_id, post_code, post_name, post_category, post_sort, status, remark, create_time)
VALUES (301, 102, 'ops', 'Ops', 'tech', 2, '0', 'seed', TIMESTAMP '2026-03-01 12:10:00');

INSERT INTO sys_user_post (user_id, post_id) VALUES (501, 300);
