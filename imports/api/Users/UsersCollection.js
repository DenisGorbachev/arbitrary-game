import UsersSchema from "./UsersSchema";

const Users = Meteor.users;

// Deny all client-side updates since we will be using methods to manage this collection
Users.deny({
  insert() {
    return true;
  },
  update() {
    return true;
  },
  remove() {
    return true;
  },
});

Users.attachSchema(UsersSchema);

Users.publicFields = {
  amount: 1,
  profile: 1,
  gravatarExistis: 1,
  md5hash: 1,
};

export default Users;
