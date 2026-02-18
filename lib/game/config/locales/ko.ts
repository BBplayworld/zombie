export const ko = {
    inventory: {
        title: '인벤토리',
        attributes: '기본 능력치',
        combatStats: '전투 능력치',
        equipment: '장착 장비',
        equip: '장착',
        unequip: '해제',
        cancel: '취소',
        empty: '비어있음',
        stats: {
            // 기본 능력치 (직관적 한글명)
            Vigor: '체력',
            Spirit: '정신',
            Might: '힘',
            Agility: '민첩',
            Luck: '행운',
            // 전투 능력치
            HP: '생명력',
            Damage: '공격력',
            Speed: '이동속도',
            Crit: '치명타율'
        },
        // 능력치별 게임 적용 설명
        statDesc: {
            Vigor: '최대 생명력 +10 / 포인트',
            Spirit: '마법 저항 & 스킬 쿨타임 감소',
            Might: '공격력 +2 / 포인트',
            Agility: '이동속도 +0.5 / 포인트',
            Luck: '치명타 확률 +1% / 포인트',
            HP: '현재 / 최대 생명력',
            Damage: '기본 공격 시 입히는 피해량',
            Speed: '캐릭터 이동 속도',
            Crit: '공격 시 2배 피해 확률'
        },
        rarities: {
            Common: '일반',
            Uncommon: '고급',
            Rare: '희귀',
            Epic: '영웅',
            Legendary: '전설'
        },
        itemTypes: {
            Helmet: '투구',
            Armor: '갑옷',
            Weapon: '무기',
            Shield: '방패',
            Boots: '장화',
            Ring: '반지'
        },
        itemPrefixes: {
            Vigor: ['견고한', '내구성의', '생명력의', '강건한'],
            Spirit: ['신비로운', '마법의', '영적인', '현명한'],
            Might: ['강력한', '용맹한', '힘찬', '맹렬한'],
            Agility: ['신속한', '날렵한', '빠른', '민첩한'],
            Luck: ['예리한', '통찰의', '정밀한', '집중된']
        },
        itemSuffixes: {
            Vigor: ['의 생명', '의 건강', '의 활력', '의 인내'],
            Spirit: ['의 마나', '의 정신', '의 마음', '의 지혜'],
            Might: ['의 힘', '의 강인함', '의 용맹', '의 위력'],
            Agility: ['의 속도', '의 질풍', '의 신속', '의 민첩'],
            Luck: ['의 시야', '의 집중', '의 정밀', '의 통찰']
        },
        controls: {
            title: '조작법',
            move: '이동: 방향키 또는 WASD',
            pause: 'ESC: 일시정지'
        }
    },
    game: {
        loading: '로딩 중...',
        paused: '일시정지',
        resume: '계속하기',
        start: '게임 시작'
    },
    ui: {
        selectLanguage: '언어 선택'
    }
}
