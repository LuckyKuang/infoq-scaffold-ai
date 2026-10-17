DROP TABLE IF EXISTS sys_user_post;
DROP TABLE IF EXISTS sys_user_role;
DROP TABLE IF EXISTS sys_role_menu;
DROP TABLE IF EXISTS sys_role_dept;
DROP TABLE IF EXISTS sys_post;
DROP TABLE IF EXISTS sys_menu;
DROP TABLE IF EXISTS sys_user;
DROP TABLE IF EXISTS sys_role;
DROP TABLE IF EXISTS sys_dept;
DROP TABLE IF EXISTS sys_dict_data;

CREATE TABLE sys_dict_data (
    dict_code BIGINT PRIMARY KEY,
    dict_sort INT,
    dict_label VARCHAR(100),
    dict_value VARCHAR(100),
    dict_type VARCHAR(100),
    css_class VARCHAR(100),
    list_class VARCHAR(100),
    is_default CHAR(1),
    remark VARCHAR(255),
    create_time TIMESTAMP
);

CREATE TABLE sys_dept (
    dept_id BIGINT PRIMARY KEY,
    parent_id BIGINT,
    ancestors VARCHAR(255),
    dept_name VARCHAR(100),
    order_num INT,
    leader BIGINT,
    del_flag CHAR(1)
);

CREATE TABLE sys_role (
    role_id BIGINT PRIMARY KEY,
    role_name VARCHAR(100),
    role_key VARCHAR(100),
    role_sort INT,
    data_scope VARCHAR(20),
    status CHAR(1),
    del_flag CHAR(1)
);

CREATE TABLE sys_role_dept (
    role_id BIGINT,
    dept_id BIGINT
);

CREATE TABLE sys_menu (
    menu_id BIGINT PRIMARY KEY,
    parent_id BIGINT,
    order_num INT,
    perms VARCHAR(100),
    status CHAR(1)
);

CREATE TABLE sys_role_menu (
    role_id BIGINT,
    menu_id BIGINT
);

CREATE TABLE sys_user (
    user_id BIGINT PRIMARY KEY,
    dept_id BIGINT,
    user_name VARCHAR(100),
    nick_name VARCHAR(100),
    email VARCHAR(100),
    avatar BIGINT,
    phonenumber VARCHAR(32),
    sex CHAR(1),
    status CHAR(1),
    del_flag CHAR(1),
    login_ip VARCHAR(64),
    login_date TIMESTAMP,
    create_by BIGINT,
    create_time TIMESTAMP,
    remark VARCHAR(255)
);

CREATE TABLE sys_user_role (
    user_id BIGINT,
    role_id BIGINT
);

CREATE TABLE sys_post (
    post_id BIGINT PRIMARY KEY,
    dept_id BIGINT,
    post_code VARCHAR(64),
    post_name VARCHAR(100),
    post_category VARCHAR(64),
    post_sort INT,
    status CHAR(1),
    remark VARCHAR(255),
    create_time TIMESTAMP
);

CREATE TABLE sys_user_post (
    user_id BIGINT,
    post_id BIGINT
);
