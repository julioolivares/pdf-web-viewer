export class Utils {
  static generateUUID() {
    return window.crypto.randomUUID().split('-').join('').substring(0, 15)
  }
}
