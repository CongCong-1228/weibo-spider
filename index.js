import { COOKIE, UID, USER_BLOG_LIST_URL, USER_INFO_URL } from './config.js';
import superagent from 'superagent';
import path from "path";
import dayjs from "dayjs";
import fs from 'fs';
import { fileURLToPath } from 'url'


// 完整路径
const __filename = fileURLToPath(import.meta.url);

// 路径的目录部分
const __dirname = path.dirname(__filename);

const MAX_RETRIES = 5;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 获取用户信息
const fetchUserInfo = async (uid, pageSize) => {
    let retry = 0;
    // 获取用户信息并根据用户名创建文件
    try {
        const {body} = await superagent.get(USER_INFO_URL).query({uid}).set('Cookie', COOKIE)
        if (body.ok === 1) {
            const {screen_name} = body.data.user
            const userPath = path.resolve(__dirname, 'assets', screen_name)
            if (!fs.existsSync(userPath)) {
                await fs.promises.mkdir(userPath, {recursive: true})
            }
            await fetchBlogLists(pageSize, userPath)
        } else {
            throw new Error(`获取用户信息失败：${ JSON.stringify(body) }`)
        }
    } catch (e) {
        retry++;
        console.error(`${ e.message }---第${ retry }次尝试`)
        if (retry === MAX_RETRIES) {
            console.error(`${ e.message }---达到次数上限`)
        }
        await sleep(2000)
    }

}

// 获取博客列表
const fetchBlogLists = async (pageSize, userPath) => {
    const currentIndex = await loadState()
    let retry = 0;
    let hasMore = true;
    let page = currentIndex > 1 ? currentIndex : 1

    console.log(`从第${ page }页开始抓取数据`)

    while (retry < MAX_RETRIES && page <= pageSize && hasMore) {
        try {
            const {body} = await superagent.get(USER_BLOG_LIST_URL).query({
                uid: UID,
                page,
                feature: 0
            }).set("Cookie", COOKIE)
            if (body.ok === 1) {
                const {list} = body.data;
                if (list && list.length && list.length > 0) {
                    console.log(`正在抓取第${ page }页的数据------------------------------------`)
                    for (const item of list) {
                        const {created_at, pic_infos, pic_num, page_info} = item;
                        const formatDate = dayjs(created_at).format('YYYY-MM-DD');
                        const dateFilePath = path.join(userPath, formatDate)
                        if (!fs.existsSync(dateFilePath)) {
                            await fs.promises.mkdir(dateFilePath, {recursive: true})
                        }
                        await saveItems(pic_num, page_info, pic_infos, dateFilePath)
                        await sleep(1000)
                    }
                    page++
                    await saveState(page)
                } else {
                    hasMore = false
                }
            } else {
                throw new Error(`获取博客列表信息失败---${ body }`)
            }
        } catch (e) {
            retry++
            if (retry === MAX_RETRIES) {
                console.error(`获取博客列表信息达最大次数---${ e.message }`)
            }
        }
    }
}

// 保存数据
const saveItems = async (pic_num, page_info, pic_infos, dateFilePath) => {
    if (pic_num !== 0) {
        for (const i of Object.keys(pic_infos)) {
            const {original, large, largest} = pic_infos[i]
            const {url} = largest
            if (url) {
                await saveImage(url, dateFilePath)
            } else {
                console.log('没有图片了~')
            }
        }
    } else {
        // pic_num为0并且page_info存在就是视频
        if (page_info && page_info.media_info) {
            const {mp4_sd_url, mp4_hd_url, mp4_720p_mp4} = page_info.media_info
            const url = mp4_720p_mp4 || mp4_hd_url || mp4_sd_url
            if (url) {
                await saveVideo(url, dateFilePath, page_info)
            }
        } else {
            // 纯文本或者转发
            // console.log('没有图片也没有视频======o.o')
        }
    }
}

// 保存图片到本地
const saveImage = async (url, userPath) => {
    const fileName = path.basename(url)
    const filePath = path.resolve(userPath, '', fileName);
    const targetFilePath = path.join(userPath, fileName);
    if (!fs.existsSync(filePath)) {
        try {
            const response = await superagent.get(url).responseType('blob')
            await fs.promises.writeFile(targetFilePath, response.body)
            console.log(`抓取图片${ targetFilePath }------成功`)
        } catch (error) {
            console.error(`抓取图片${ url }------报错${ error }`)
        }
    } else {
        console.log('存在该图片')
    }
}

// 保存视频到本地
const saveVideo = async (url, fileDatePath, page_info) => {
    const pathName = path.basename(url)
    const fileName = pathName.substring(pathName.indexOf('?'), 0)
    const filePath = path.resolve(fileDatePath, '', fileName)
    const targetFilePath = path.resolve(fileDatePath, fileName)
    if (!fs.existsSync(filePath)) {
        try {
            const response = await superagent.get(url).responseType('blob')
            await fs.promises.writeFile(targetFilePath, response.body)
            console.log(`抓取视频${ targetFilePath }------成功`)
        } catch (error) {
            console.error(`抓取视频${ url }-----报错${ error }`)
        }
    } else {
        console.log('存在该视频')
    }
}

// 保存中断currentIndex
const saveState = async (index) => {
    const json = 'state.json'
    await fs.promises.writeFile(json, JSON.stringify({index}))
}


// 获取中断currentIndex
const loadState = async () => {
    if (fs.existsSync('state.json')) {
        const {index} = JSON.parse(await fs.promises.readFile('state.json', 'utf-8'))
        return index
    }
}


// 命令行传参
const [uid, pageSize] = process.argv.slice(2)


await fetchUserInfo(uid, pageSize)

