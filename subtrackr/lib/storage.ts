import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  //  Tokens 
  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem('accessToken', token);
  },
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('accessToken');
  },

  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem('refreshToken', token);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem('refreshToken');
  },

  //  User 
  async setUser(user: object): Promise<void> {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  },
  async getUser(): Promise<any> {
    const u = await AsyncStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  //  Clear 
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  },
};