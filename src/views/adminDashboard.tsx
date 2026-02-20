import React from 'react';
import View from './view';
import { useNavigate } from 'react-router-dom';
import NotFound from './notFound';
import Button from '../components/button';
import { pizzaService } from '../service/service';
import { Franchise, FranchiseList, Role, Store, User } from '../service/pizzaService';
import { TrashIcon } from '../icons';

type UserList = { users: User[]; more: boolean };

interface Props {
  user: User | null;
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();

  const [userList, setUserList] = React.useState<UserList>({ users: [], more: false });
  const [userPage, setUserPage] = React.useState(1);
  const filterUserRef = React.useRef<HTMLInputElement>(null);

  async function loadUsers(page: number, name: string) {
    const safeName = name && name.trim().length > 0 ? name.trim() : '*';
    const result = await pizzaService.listUsers(page, 2, safeName); 
    setUserList(result);
  }

  React.useEffect(() => {
    (async () => {
      if (Role.isRole(props.user, Role.Admin)) {
        await loadUsers(userPage, '*');
      }
    })();
  }, [props.user, userPage]);

  async function searchUsers() {
    const q = filterUserRef.current?.value ?? '';
    await loadUsers(1, q);
    setUserPage(1);
  }

  async function deleteUser(u: User) {
    await pizzaService.deleteUser(u.id);
    const q = filterUserRef.current?.value ?? '*';
    await loadUsers(userPage, q);
  }


  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({ franchises: [], more: false });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const filterFranchiseRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      if (Role.isRole(props.user, Role.Admin)) {
        setFranchiseList(await pizzaService.getFranchises(franchisePage, 3, '*'));
      }
    })();
  }, [props.user, franchisePage]);

  function createFranchise() {
    navigate('/admin-dashboard/create-franchise');
  }

  async function closeFranchise(franchise: Franchise) {
    navigate('/admin-dashboard/close-franchise', { state: { franchise } });
  }

  async function closeStore(franchise: Franchise, store: Store) {
    navigate('/admin-dashboard/close-store', { state: { franchise, store } });
  }

  async function filterFranchises() {
    setFranchiseList(await pizzaService.getFranchises(franchisePage, 10, `*${filterFranchiseRef.current?.value}*`));
  }

  let response = <NotFound />;

  if (Role.isRole(props.user, Role.Admin)) {
    response = (
      <View title="Mama Ricci's kitchen">
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Users</h3>
          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Name', 'Email', 'Role', 'Action'].map((header) => (
                            <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200">
                        {userList.users.length === 0 ? (
                          <tr>
                            <td className="px-6 py-6 text-center text-sm text-gray-700" colSpan={4}>
                              No users found
                            </td>
                          </tr>
                        ) : (
                          userList.users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-100">
                              <td className="px-6 py-3 text-start text-sm text-gray-800">{u.name}</td>
                              <td className="px-6 py-3 text-start text-sm text-gray-800">{u.email}</td>
                              <td className="px-6 py-3 text-start text-sm text-gray-800">
                                {(u.roles ?? [])
                                  .map((r) => (r.role === 'franchisee' && r.objectId ? `franchisee(${r.objectId})` : r.role))
                                  .join(', ')}
                              </td>
                              <td className="px-6 py-3 text-end text-sm font-medium">
                                <button
                                  type="button"
                                  aria-label={`Delete ${u.name}`}
                                  className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                                  onClick={() => deleteUser(u)}
                                >
                                  <TrashIcon />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td className="px-1 py-2" colSpan={2}>
                            <input
                              type="text"
                              ref={filterUserRef}
                              name="filterUser"
                              placeholder="Filter users"
                              className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                            <button
                              type="button"
                              className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                              onClick={searchUsers}
                            >
                              Search
                            </button>
                          </td>

                          <td colSpan={2} className="text-end text-sm font-medium">
                            <button
                              type="button"
                              aria-label="Prev"
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                              disabled={userPage <= 1}
                            >
                              «
                            </button>
                            <button
                              type="button"
                              aria-label="Next"
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setUserPage((p) => p + 1)}
                              disabled={!userList.more}
                            >
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <h3 className="text-neutral-100 text-xl">Franchises</h3>
          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Franchise', 'Franchisee', 'Store', 'Revenue', 'Action'].map((header) => (
                            <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      {franchiseList.franchises.map((franchise, findex) => (
                        <tbody key={findex} className="divide-y divide-gray-200">
                          <tr className="border-neutral-500 border-t-2">
                            <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">{franchise.name}</td>
                            <td className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800" colSpan={3}>
                              {franchise.admins?.map((o) => o.name).join(', ')}
                            </td>
                            <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                              <button
                                type="button"
                                className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400  hover:border-orange-800 hover:text-orange-800"
                                onClick={() => closeFranchise(franchise)}
                              >
                                <TrashIcon />
                                Close
                              </button>
                            </td>
                          </tr>

                          {franchise.stores.map((store, sindex) => (
                            <tr key={sindex} className="bg-neutral-100">
                              <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800" colSpan={3}>
                                {store.name}
                              </td>
                              <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">{store.totalRevenue?.toLocaleString()} ₿</td>
                              <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                <button
                                  type="button"
                                  className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                                  onClick={() => closeStore(franchise, store)}
                                >
                                  <TrashIcon />
                                  Close
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}

                      <tfoot>
                        <tr>
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              ref={filterFranchiseRef}
                              name="filterFranchise"
                              placeholder="Search franchises"
                              className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                            <button
                              type="button"
                              className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                              onClick={filterFranchises}
                            >
                              Submit
                            </button>
                          </td>
                          <td colSpan={4} className="text-end text-sm font-medium">
                            <button
                              type="button"
                              aria-label="Back franchises"
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setFranchisePage(franchisePage - 1)}
                              disabled={franchisePage <= 0}
                            >
                              «
                            </button>
                            <button
                              type="button"
                              aria-label="More franchises" 
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setFranchisePage(franchisePage + 1)}
                              disabled={!franchiseList.more}
                            >
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <Button className="w-36 text-xs sm:text-sm sm:w-64" title="Add Franchise" onPress={createFranchise} />
        </div>
      </View>
    );
  }

  return response;
}